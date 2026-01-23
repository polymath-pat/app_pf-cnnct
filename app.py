import os
import requests
from flask import Flask, request, jsonify
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.middleware.proxy_fix import ProxyFix

app = Flask(__name__)

# Trust the headers from DO Load Balancer or local Nginx
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)

# Connect to Redis (DO provided or Docker)
redis_url = os.environ.get("REDIS_URL", "memory://")

limiter = Limiter(
    get_remote_address,
    app=app,
    storage_uri=redis_url,
    storage_options={"socket_connect_timeout": 1}, 
    strategy="fixed-window"
)

# 1. NEW: Simple Health Check (used by DO and Makefile)
@app.route('/healthz')
def health_check():
    return jsonify({"status": "ok"}), 200

# 2. UPDATED: Path matches the spec.yaml route
# We use /api/cnnct so the Frontend fetch('/api/cnnct') hits exactly right.
@app.route('/api/cnnct')
@limiter.limit("5 per minute")
def network_check():
    target = request.args.get('target')

    if not target:
        return jsonify({"error": "Target missing. Usage: /api/cnnct?target=1.1.1.1"}), 400

    if not target.startswith(('http://', 'https://')):
        target = f'http://{target}'

    try:
        # User-Agent header added to prevent some sites from blocking the request
        headers = {'User-Agent': 'DO-Network-Tester/1.0'}
        response = requests.get(target, timeout=5, headers=headers)
        return jsonify({
            "status": "Connected",
            "destination": target,
            "http_code": response.status_code,
            "body": response.text[:200]
        })
    except Exception as e:
        return jsonify({"status": "Failed", "error": str(e)}), 500

@app.errorhandler(429)
def ratelimit_handler(e):
    return jsonify({
        "error": "Rate limit exceeded",
        "message": "Too many requests. Redis is watching!",
        "limit": str(e.description)
    }), 429

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host='0.0.0.0', port=port)