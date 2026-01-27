import os
import logging
import sys
import socket
import requests
import time
import dns.resolver  # Requires dnspython in requirements.txt
from flask import Flask, request, jsonify
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.middleware.proxy_fix import ProxyFix

# Configure Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] in %(module)s: %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=2)

# Configure Rate Limiting
redis_url = os.environ.get("REDIS_URL", "memory://")
limiter = Limiter(
    get_remote_address,
    app=app,
    storage_uri=redis_url,
    default_limits=["100 per hour", "20 per minute"],
    strategy="fixed-window",
)

@app.route('/healthz')
@limiter.exempt
def health_check():
    return jsonify({"status": "healthy"}), 200

# Nginx proxies /api/dns/<domain> to /dns/<domain>
@app.route('/dns/<domain>', methods=['GET'])
@limiter.limit("10 per minute")
def check_dns(domain):
    try:
        result = dns.resolver.resolve(domain, 'A')
        ips = [ip.to_text() for ip in result]
        return jsonify({"target": domain, "records": ips, "timestamp": time.time()})
    except Exception as e:
        logger.error(f"DNS lookup failed: {str(e)}")
        return jsonify({"error": str(e)}), 400

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

if __name__ == "__main__":
    # Bandit B104: binding to 0.0.0.0 is required for container networking
    host = os.environ.get("HOST", "0.0.0.0")  # nosec B104
    port = int(os.environ.get("PORT", 8080))
    app.run(host=host, port=port)