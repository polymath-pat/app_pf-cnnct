import logging
import sys
import threading
import time
from datetime import datetime, timezone
from urllib.parse import urlparse


class OpenSearchHandler(logging.Handler):
    """Logging handler that buffers records and flushes them to OpenSearch.

    Parses OPENSEARCH_URL (https://user:pass@host:port) for connection details.
    Uses a background thread to flush buffered records every `flush_interval`
    seconds or when the buffer reaches `buffer_size` records.
    """

    def __init__(self, opensearch_url, buffer_size=10, flush_interval=5.0):
        super().__init__()
        self._client = None
        self._buffer = []
        self._lock = threading.Lock()
        self._buffer_size = buffer_size
        self._flush_interval = flush_interval
        self._closed = False

        parsed = urlparse(opensearch_url)
        host = parsed.hostname or "localhost"
        port = parsed.port or 9200
        scheme = parsed.scheme or "https"
        auth = None
        if parsed.username and parsed.password:
            auth = (parsed.username, parsed.password)

        try:
            from opensearchpy import OpenSearch
            self._client = OpenSearch(
                hosts=[{"host": host, "port": port}],
                http_auth=auth,
                use_ssl=(scheme == "https"),
                verify_certs=False,
                ssl_show_warn=False,
                timeout=10,
                max_retries=2,
                retry_on_timeout=True,
            )
        except Exception as e:
            print(f"[OpenSearchHandler] Failed to create client: {e}", file=sys.stderr)
            return

        self._flush_thread = threading.Thread(target=self._periodic_flush, daemon=True)
        self._flush_thread.start()

    def emit(self, record):
        if self._client is None:
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
                self._buffer.append(doc)
                if len(self._buffer) >= self._buffer_size:
                    self._flush_locked()
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

        index_name = f"cnnct-logs-{datetime.now(timezone.utc).strftime('%Y.%m.%d')}"
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


def _json_line(obj):
    import json
    return json.dumps(obj, default=str)
