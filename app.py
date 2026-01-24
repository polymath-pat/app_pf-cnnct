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
        logger.error(f"DNS lookup failed for {domain}: {str(e)}")
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
    except Exception:
        # B110: pass is replaced with a log to indicate the port is closed/unreachable
        logger.info(f"Connection failed to {target} on port 443")
    
    return jsonify(results)

if __name__ == "__main__":
    # B104: Binding to 0.0.0.0 is required for container networking
    host = os.environ.get("HOST", "0.0.0.0")  # nosec B104
    port = int(os.environ.get("PORT", 8080))
    app.run(host=host, port=port)