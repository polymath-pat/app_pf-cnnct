import logging
import re
import sys
import threading
import time
from datetime import datetime, timezone


class OpenSearchHandler(logging.Handler):
    """Logging handler that buffers records and flushes them to OpenSearch.

    Parses OPENSEARCH_URL (https://user:pass@host:port) for connection details.
    Handles passwords with special characters that break standard urlparse.
    Uses a background thread to flush buffered records every `flush_interval`
    seconds. Records are never flushed synchronously in emit() to avoid
    blocking the calling thread if OpenSearch is slow or unreachable.
    """

    MAX_BUFFER_SIZE = 1000

    def __init__(self, opensearch_url, buffer_size=10, flush_interval=5.0,
                 index_prefix="cnnct-logs"):
        super().__init__()
        self._client = None
        self._buffer = []
        self._lock = threading.Lock()
        self._buffer_size = buffer_size
        self._flush_interval = flush_interval
        self._index_prefix = index_prefix
        self._closed = False

        scheme, auth, host, port = _parse_opensearch_url(opensearch_url)

        try:
            from opensearchpy import OpenSearch
            self._client = OpenSearch(
                hosts=[{"host": host, "port": port}],
                http_auth=auth,
                use_ssl=(scheme == "https"),
                verify_certs=False,
                ssl_show_warn=False,
                timeout=5,
                max_retries=1,
                retry_on_timeout=False,
            )
        except Exception as e:
            print(f"[OpenSearchHandler] Failed to create client: {e}", file=sys.stderr)
            return

        self._flush_thread = threading.Thread(target=self._periodic_flush, daemon=True)
        self._flush_thread.start()

    # Logger names from opensearch-py that would cause a feedback loop
    _IGNORED_LOGGERS = ("opensearch", "urllib3")

    def emit(self, record):
        if self._client is None:
            return
        if record.name.startswith(self._IGNORED_LOGGERS):
            return
        try:
            doc = {
                "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
                "level": record.levelname,
                "module": record.module,
                "logger": record.name,
                "message": self.format(record),
            }
            with self._lock:
                if len(self._buffer) < self.MAX_BUFFER_SIZE:
                    self._buffer.append(doc)
        except Exception:
            self.handleError(record)

    def _periodic_flush(self):
        while not self._closed:
            time.sleep(self._flush_interval)
            with self._lock:
                if self._buffer:
                    self._flush_locked()

    def _flush_locked(self):
        """Flush buffer to OpenSearch. Must be called with self._lock held."""
        if not self._buffer or self._client is None:
            return

        docs = self._buffer[:]
        self._buffer.clear()

        index_name = f"{self._index_prefix}-{datetime.now(timezone.utc).strftime('%Y.%m.%d')}"
        actions = []
        for doc in docs:
            actions.append({"index": {"_index": index_name}})
            actions.append(doc)

        try:
            body = "\n".join(_json_line(a) for a in actions) + "\n"
            self._client.bulk(body=body)
        except Exception as e:
            print(f"[OpenSearchHandler] Flush failed: {e}", file=sys.stderr)

    def flush(self):
        with self._lock:
            self._flush_locked()

    def close(self):
        self._closed = True
        self.flush()
        super().close()


def _parse_opensearch_url(url):
    """Parse an OpenSearch URL, handling passwords with special characters.

    Supports: scheme://user:pass@host:port
    Returns: (scheme, auth_tuple_or_None, host, port)
    """
    # Extract scheme
    match = re.match(r'^(https?)://(.+)$', url)
    if not match:
        return "https", None, "localhost", 9200
    scheme = match.group(1)
    remainder = match.group(2)

    # Split on last '@' to separate credentials from host (password may contain '@')
    auth = None
    if '@' in remainder:
        creds, hostpart = remainder.rsplit('@', 1)
        # Split on first ':' to separate user from password
        if ':' in creds:
            user, password = creds.split(':', 1)
            auth = (user, password)
    else:
        hostpart = remainder

    # Parse host:port
    if ':' in hostpart:
        host, port_str = hostpart.rsplit(':', 1)
        try:
            port = int(port_str)
        except ValueError:
            host = hostpart
            port = 9200
    else:
        host = hostpart
        port = 9200

    return scheme, auth, host, port


def _json_line(obj):
    import json
    return json.dumps(obj, default=str)
