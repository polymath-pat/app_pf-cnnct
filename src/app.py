import os
import logging
import sys
import socket
import requests
import time
import json
import dns.resolver  # Requires dnspython in requirements.txt
import redis
from flask import Flask, request, jsonify, Response
from datetime import datetime, timezone
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.middleware.proxy_fix import ProxyFix
from contextlib import contextmanager
from flask_migrate import Migrate

try:
    from models import Base, WebhookEvent, get_engine, get_session_factory
except ImportError:
    from src.models import Base, WebhookEvent, get_engine, get_session_factory

# Configure Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] in %(module)s: %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=2)

# Initialize Flask-Migrate
migrate = Migrate()

# Configure Rate Limiting
redis_url = os.environ.get("REDIS_URL", "memory://")

# Database configuration
database_url = os.environ.get("DATABASE_URL", "")
_db_engine = None
_db_session_factory = None
_use_postgres = False

# Webhook receiver configuration
webhook_secret = os.environ.get("WEBHOOK_SECRET", "")
webhook_dns_target = os.environ.get("WEBHOOK_DNS_TARGET", "example.com")

# In-memory fallback for webhook results when PostgreSQL is unavailable
_webhook_results_memory: list = []
WEBHOOK_RESULTS_MAX = 50
limiter = Limiter(
    get_remote_address,
    app=app,
    storage_uri=redis_url,
    storage_options={
        "socket_connect_timeout": 5,
        "socket_timeout": 5,
    },
    default_limits=["100 per hour", "20 per minute"],
    strategy="fixed-window",
    in_memory_fallback_enabled=True,
)


def init_database():
    """Initialize PostgreSQL database connection if configured."""
    global _db_engine, _db_session_factory, _use_postgres
    if database_url:
        try:
            _db_engine = get_engine(database_url)
            _db_session_factory = get_session_factory(_db_engine)
            # Initialize Flask-Migrate with the app and Base metadata
            migrate.init_app(app, _db_engine, directory='migrations')
            _use_postgres = True
            logger.info("PostgreSQL database initialized")
        except Exception as e:
            logger.warning(f"PostgreSQL init failed, falling back to Redis/memory: {e}")


@contextmanager
def get_db_session():
    """Get a database session with automatic commit/rollback."""
    if not _use_postgres or not _db_session_factory:
        yield None
        return
    session = _db_session_factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


# Initialize database at module load
init_database()

@app.route('/healthz')
@limiter.exempt
def health_check():
    return jsonify({"status": "healthy"}), 200


def _resolve_dns(domain: str) -> tuple[list[str], str | None]:
    """Resolve DNS A records for a domain.

    Returns:
        Tuple of (list of IP addresses, error message or None)
    """
    try:
        result = dns.resolver.resolve(domain, 'A')
        return [ip.to_text() for ip in result], None
    except Exception as e:
        logger.error(f"DNS lookup failed for {domain}: {str(e)}")
        return [], str(e)


# Nginx proxies /api/dns/<domain> to /dns/<domain>
@app.route('/dns/<domain>', methods=['GET'])
@limiter.limit("10 per minute")
def check_dns(domain):
    records, error = _resolve_dns(domain)
    if error:
        return jsonify({"error": error}), 400
    return jsonify({"target": domain, "records": records, "timestamp": time.time()})

# Nginx proxies /api/cnnct to /cnnct
@app.route('/cnnct', methods=['GET'])
def cnnct():
    target = request.args.get('target')
    if not target:
        return jsonify({"error": "No target specified"}), 400

    results = {"target": target, "tcp_443": False, "latency_ms": None}
    start_time = time.perf_counter()
    try:
        with socket.create_connection((target, 443), timeout=3):
            results["tcp_443"] = True
            latency = (time.perf_counter() - start_time) * 1000
            results["latency_ms"] = round(latency, 2)
    except Exception as e:
        logger.info(f"Connection failed to {target}: {str(e)}")
    return jsonify(results)

# New HTTP Diagnostic Route
@app.route('/diag', methods=['GET'])
@limiter.limit("5 per minute")
def diagnose_url():
    url = request.args.get('url')
    if not url:
        return jsonify({"error": "No URL specified"}), 400
    
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url

    try:
        start_time = time.perf_counter()
        response = requests.get(url, timeout=5, allow_redirects=True)
        total_time = time.perf_counter() - start_time
        
        speed_download = len(response.content) / total_time if total_time > 0 else 0
        
        remote_ip = "Unknown"
        try:
            remote_ip = socket.gethostbyname(response.url.split('//')[1].split('/')[0])
        except Exception as e:
            logger.info(f"Could not resolve remote IP for {url}: {e}")

        return jsonify({
            "url": response.url,
            "http_code": response.status_code,
            "method": request.method,
            "remote_ip": remote_ip,
            "total_time_ms": round(total_time * 1000, 2),
            "speed_download_bps": round(speed_download, 2),
            "content_type": response.headers.get('Content-Type', 'unknown'),
            "redirects": len(response.history)
        })
    except Exception as e:
        logger.error(f"HTTP Diag failed for {url}: {str(e)}")
        return jsonify({"error": str(e)}), 400


def _store_webhook_result(result: dict):
    """Store a webhook result in PostgreSQL or memory fallback."""
    global _webhook_results_memory

    # Try PostgreSQL first
    if _use_postgres:
        try:
            with get_db_session() as session:
                if session:
                    event = WebhookEvent(
                        timestamp=datetime.fromisoformat(result["timestamp"].replace("Z", "+00:00")),
                        event_type=result["event_type"],
                        source_ip=result["source_ip"],
                        dns_target=result["dns_target"],
                        dns_records=result["dns_records"],
                        dns_error=result["dns_error"],
                        payload=result["payload"]
                    )
                    session.add(event)
                    logger.info("Webhook stored in PostgreSQL")
                    return
        except Exception as e:
            logger.warning(f"PostgreSQL store failed, using memory: {e}")

    # Memory fallback
    _webhook_results_memory.insert(0, result)
    _webhook_results_memory = _webhook_results_memory[:WEBHOOK_RESULTS_MAX]


def _get_webhook_results() -> list:
    """Retrieve webhook results from PostgreSQL or memory fallback."""
    # Try PostgreSQL first
    if _use_postgres:
        try:
            with get_db_session() as session:
                if session:
                    events = session.query(WebhookEvent)\
                        .order_by(WebhookEvent.timestamp.desc())\
                        .limit(WEBHOOK_RESULTS_MAX)\
                        .all()
                    return [
                        {
                            "id": str(e.id),
                            "timestamp": e.timestamp.isoformat().replace("+00:00", "Z"),
                            "event_type": e.event_type,
                            "source_ip": e.source_ip,
                            "dns_target": e.dns_target,
                            "dns_records": e.dns_records or [],
                            "dns_error": e.dns_error,
                            "payload": e.payload or {}
                        }
                        for e in events
                    ]
        except Exception as e:
            logger.warning(f"PostgreSQL fetch failed, using memory: {e}")

    return _webhook_results_memory


@app.route('/webhook-receive/<secret>', methods=['POST'])
@limiter.limit("10 per minute")
def receive_webhook(secret):
    """Receive incoming webhooks, perform DNS lookup, store results."""
    if not webhook_secret:
        return jsonify({"error": "Webhook receiver not configured"}), 503

    if secret != webhook_secret:
        logger.warning(f"Invalid webhook secret attempt")
        return jsonify({"error": "Invalid secret"}), 403

    # Parse incoming webhook payload (Pomofocus format: type, round, task, seconds, etc.)
    payload = request.get_json() or {}
    event_type = payload.get("type") or payload.get("event") or "unknown"

    # Perform DNS lookup on configured target
    dns_records, dns_error = _resolve_dns(webhook_dns_target)

    # Build result entry
    result_entry = {
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "event_type": event_type,
        "source_ip": get_remote_address(),
        "dns_target": webhook_dns_target,
        "dns_records": dns_records,
        "dns_error": dns_error,
        "payload": payload
    }

    _store_webhook_result(result_entry)
    logger.info(f"Webhook received: event={event_type}, dns_records={dns_records}")

    return jsonify({
        "status": "received",
        "dns_target": webhook_dns_target,
        "dns_records": dns_records,
        "dns_error": dns_error
    })


@app.route('/webhook-results', methods=['GET'])
@limiter.limit("10 per minute")
def get_webhook_results():
    """Retrieve stored webhook results."""
    results = _get_webhook_results()
    return jsonify({
        "count": len(results),
        "results": results
    })


@app.route('/webhook-results/rss', methods=['GET'])
@limiter.limit("10 per minute")
def get_webhook_results_rss():
    """Retrieve stored webhook results as RSS feed."""
    results = _get_webhook_results()

    # Build RSS 2.0 XML
    base_url = request.url_root.rstrip('/')
    items_xml = ""
    for r in results[:20]:  # Limit to 20 items for RSS
        payload = r.get("payload", {})
        task = payload.get("task", "(no task)")
        round_type = payload.get("round", "unknown")
        event_type = r.get("event_type", "unknown")
        timestamp = r.get("timestamp", "")

        # Format pub date for RSS (RFC 822)
        try:
            dt = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
            pub_date = dt.strftime("%a, %d %b %Y %H:%M:%S +0000")
        except (ValueError, AttributeError):
            pub_date = timestamp

        title = f"{round_type.replace('_', ' ').title()}: {task}"
        description = f"Event: {event_type}, Round: {round_type}"
        if payload.get("seconds"):
            description += f", Duration: {payload['seconds'] // 60}m"

        items_xml += f"""
        <item>
            <title><![CDATA[{title}]]></title>
            <description><![CDATA[{description}]]></description>
            <pubDate>{pub_date}</pubDate>
            <guid isPermaLink="false">{r.get('id', timestamp)}</guid>
        </item>"""

    rss_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
    <channel>
        <title>CNNCT Webhook Events</title>
        <link>{base_url}</link>
        <description>Recent webhook events received by CNNCT</description>
        <lastBuildDate>{datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S +0000")}</lastBuildDate>
        {items_xml}
    </channel>
</rss>"""

    return Response(rss_xml, mimetype='application/rss+xml')


@app.route('/status', methods=['GET'])
@limiter.limit("5 per minute")
def redis_status():
    if redis_url == "memory://":
        return jsonify({
            "backend": "memory",
            "connected": False,
            "message": "Using in-memory rate limiting (no Redis configured)"
        })

    try:
        start_time = time.perf_counter()
        r = redis.from_url(redis_url, socket_connect_timeout=5, socket_timeout=5)
        info = r.info(section="server")
        latency = (time.perf_counter() - start_time) * 1000

        return jsonify({
            "backend": "redis",
            "connected": True,
            "latency_ms": round(latency, 2),
            "version": info.get("redis_version", "unknown"),
            "uptime_seconds": info.get("uptime_in_seconds", 0),
            "connected_clients": r.info(section="clients").get("connected_clients", 0),
            "used_memory_human": r.info(section="memory").get("used_memory_human", "unknown"),
        })
    except Exception as e:
        logger.error(f"Redis status check failed: {str(e)}")
        return jsonify({
            "backend": "redis",
            "connected": False,
            "error": str(e)
        }), 503


@app.route('/db-status', methods=['GET'])
@limiter.limit("5 per minute")
def db_status():
    """Check PostgreSQL database connection status."""
    if not database_url:
        return jsonify({
            "backend": "none",
            "connected": False,
            "message": "No DATABASE_URL configured"
        })

    if not _use_postgres:
        return jsonify({
            "backend": "postgres",
            "connected": False,
            "message": "PostgreSQL initialization failed"
        }), 503

    try:
        from sqlalchemy import text
        start_time = time.perf_counter()
        with get_db_session() as session:
            if session:
                result = session.execute(text("SELECT version()"))
                version = result.scalar()
                latency = (time.perf_counter() - start_time) * 1000

                # Get webhook event count
                event_count = session.query(WebhookEvent).count()

                return jsonify({
                    "backend": "postgres",
                    "connected": True,
                    "latency_ms": round(latency, 2),
                    "version": version,
                    "webhook_events_count": event_count
                })
    except Exception as e:
        logger.error(f"PostgreSQL status check failed: {str(e)}")
        return jsonify({
            "backend": "postgres",
            "connected": False,
            "error": str(e)
        }), 503


if __name__ == "__main__":
    # Bandit B104: binding to 0.0.0.0 is required for container networking
    host = os.environ.get("HOST", "0.0.0.0")  # nosec B104
    port = int(os.environ.get("PORT", 8080))
    app.run(host=host, port=port)