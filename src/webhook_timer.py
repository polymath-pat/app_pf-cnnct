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

    # Round-robin test cycle: port_check → dns_lookup → http_diag
    _TEST_TYPES = [
        ("port_check", "Port Check"),
        ("dns_lookup", "DNS Lookup"),
        ("http_diag", "HTTP Diag"),
    ]

    def _run(self):
        url = f"{self._base_url}/webhook-receive/{self._secret}"
        test_index = 0

        while not self._closed:
            session_start = int(time.time() * 1000)
            time.sleep(self._interval)
            if self._closed:
                break
            session_end = int(time.time() * 1000)

            test_type, task_label = self._TEST_TYPES[test_index % len(self._TEST_TYPES)]
            test_index += 1

            test_result = self._run_api_test(test_type)

            payload = {
                "type": "self_ping",
                "round": "api",
                "task": task_label,
                "seconds": self._interval,
                "session_start": session_start,
                "session_end": session_end,
                "source": "webhook_timer",
                "dns_target": self._dns_target,
                "test_type": test_type,
                "test_target": self._dns_target,
                "test_result": test_result,
            }
            try:
                resp = requests.post(url, json=payload, timeout=5)
                logger.info(f"Self-ping sent: type={test_type} status={resp.status_code}")
            except Exception as e:
                logger.warning(f"Self-ping failed: {e}")

    def _run_api_test(self, test_type):
        """Run an API test and return the JSON result."""
        try:
            if test_type == "port_check":
                endpoint = f"{self._base_url}/cnnct?target={self._dns_target}"
            elif test_type == "dns_lookup":
                endpoint = f"{self._base_url}/dns/{self._dns_target}"
            elif test_type == "http_diag":
                endpoint = f"{self._base_url}/diag?url=https://{self._dns_target}"
            else:
                return None

            resp = requests.get(endpoint, timeout=10)
            return resp.json()
        except Exception as e:
            logger.warning(f"API test {test_type} failed: {e}")
            return {"error": str(e)}

    def close(self):
        self._closed = True
        if self._lock_file:
            try:
                fcntl.flock(self._lock_file, fcntl.LOCK_UN)
                self._lock_file.close()
            except Exception:  # nosec B110 - best-effort cleanup during shutdown
                pass
