import os
import logging
import sys
import socket
import requests
from flask import Flask, request, jsonify
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.middleware.proxy_fix import ProxyFix

# 1. Configure Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] in %(module)s: %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# FIX: Trust the DigitalOcean Load Balancer
# x_for=2 is often needed for DO App Platform's multi-tier proxy setup
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=2)

# 2. Configure Rate Limiting (Valkey/Redis)
redis_url = os.environ.get("REDIS_URL", "memory://")
logger.info(f"Initializing rate limiter with storage: {redis_url.split('@')[-1]}")

limiter = Limiter(
    get_remote_address,
    app=app,
    storage_uri=redis_url,
    # Standard limits for the whole app
    default_limits=["100 per hour", "20 per minute"],
    storage_options={"socket_connect_timeout": 30},
    strategy="fixed-window",
)

# 3. Routes
@app.route('/healthz')
@limiter.exempt  # CRITICAL FIX: Prevents DigitalOcean probes from being rate-limited
def health_check():
    """Health check endpoint for DigitalOcean and CI/CD probes."""
    return jsonify({"status": "healthy"}), 200

@app.route('/cnnct', methods=['GET'])
def cnnct():
    target = request.args.get('target')
    
    if not target:
        logger.warning("Aborted: Request missing 'target' parameter")
        return jsonify({"error": "No target specified"}), 400

    # request.remote_addr will now show the actual User IP thanks to ProxyFix
    logger.info(f"Probing target: {target} for User: {request.remote_addr}")

    results = {
        "target": target,
        "tcp_80": False,
        "tcp_443": False,
        "http_response": None
    }

    # TCP Port Probes
    for port in [80, 443]:
        try:
            with socket.create_connection((target, port), timeout=3):
                results[f"tcp_{port}"] = True
                logger.info(f"Port {port} is OPEN on {target}")
        except (socket.timeout, ConnectionRefusedError, socket.gaierror) as e:
            logger.debug(f"Port {port} closed/timeout on {target}: {e}")

    # HTTP Probe
    try:
        response = requests.get(f"http://{target}", timeout=5)
        results["http_response"] = response.status_code
        logger.info(f"HTTP GET {target} returned {response.status_code}")
    except Exception as e:
        logger.error(f"HTTP Probe failed for {target}: {str(e)}")
        results["http_error"] = "Unreachable"

    return jsonify(results)

# 4. Entry Point
if __name__ == "__main__":
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", 8080))
    
    logger.info(f"Starting application on {host}:{port}")
    app.run(host=host, port=port)