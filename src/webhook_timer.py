import fcntl
import logging
import threading
import time

import requests

logger = logging.getLogger("cnnct.timer")

LOCK_PATH = "/tmp/cnnct-webhook-timer.lock"  # nosec B108 - lock file only, no sensitive data


class WebhookTimer:
    """Background timer that periodically POSTs to the app's own webhook endpoint.

    Uses a file lock so only one Gunicorn worker runs the timer.
    """

    def __init__(self, base_url, secret, interval, dns_target):
        self._base_url = base_url.rstrip("/")
        self._secret = secret
        self._interval = interval
        self._dns_target = dns_target
        self._closed = False
        self._lock_file = None

        # Try to acquire file lock — skip if another worker holds it
        try:
            self._lock_file = open(LOCK_PATH, "w")
            fcntl.flock(self._lock_file, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except (OSError, IOError):
            logger.info("Another worker holds the timer lock, skipping timer start")
            if self._lock_file:
                self._lock_file.close()
                self._lock_file = None
            return

        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()
        logger.info(f"WebhookTimer started: interval={interval}s, target={dns_target}")

    def _run(self):
        url = f"{self._base_url}/webhook-receive/{self._secret}"
        payload = {
            "type": "self_ping",
            "source": "webhook_timer",
            "dns_target": self._dns_target,
        }

        while not self._closed:
            time.sleep(self._interval)
            if self._closed:
                break
            try:
                resp = requests.post(url, json=payload, timeout=5)
                logger.info(f"Self-ping sent: status={resp.status_code}")
            except Exception as e:
                logger.warning(f"Self-ping failed: {e}")

    def close(self):
        self._closed = True
        if self._lock_file:
            try:
                fcntl.flock(self._lock_file, fcntl.LOCK_UN)
                self._lock_file.close()
            except Exception:  # nosec B110 - best-effort cleanup during shutdown
                pass
