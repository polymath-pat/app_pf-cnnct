import pytest
from unittest.mock import patch, MagicMock, Mock
from src.app import app
import requests_mock
from datetime import datetime, timezone

@pytest.fixture
def client():
    app.config['TESTING'] = True
    from src.app import limiter
    limiter.enabled = False
    with app.test_client() as client:
        yield client


@pytest.fixture
def mock_db_session():
    """Create a mock database session for testing."""
    session = MagicMock()
    return session

def test_health_check(client):
    """Verify the healthz endpoint is alive."""
    rv = client.get('/healthz')
    assert rv.status_code == 200
    assert b'healthy' in rv.data

def test_diag_logic(client):
    """Verify the diagnostic tool parses response data correctly."""
    target_url = "https://example.com"
    with requests_mock.Mocker() as m:
        m.get(target_url, text="mock data", status_code=200)

        rv = client.get(f'/diag?url={target_url}')
        data = rv.get_json()

        assert rv.status_code == 200
        assert data['http_code'] == 200
        assert 'total_time_ms' in data
        assert 'speed_download_bps' in data

def test_status_memory_fallback(client):
    """Verify /status returns memory fallback when no Redis is configured."""
    rv = client.get('/status')
    data = rv.get_json()

    assert rv.status_code == 200
    assert data['backend'] == 'memory'
    assert data['connected'] is False
    assert 'message' in data

@patch('src.app.redis_url', 'redis://fake-host:6379')
@patch('src.app.redis')
def test_status_redis_connected(mock_redis, client):
    """Verify /status returns Redis info when connected."""
    mock_conn = MagicMock()
    mock_conn.info.side_effect = lambda section="default": {
        "server": {"redis_version": "7.2.0", "uptime_in_seconds": 86400},
        "clients": {"connected_clients": 3},
        "memory": {"used_memory_human": "1.5M"},
    }.get(section, {})
    mock_redis.from_url.return_value = mock_conn

    rv = client.get('/status')
    data = rv.get_json()

    assert rv.status_code == 200
    assert data['backend'] == 'redis'
    assert data['connected'] is True
    assert data['version'] == '7.2.0'
    assert data['uptime_seconds'] == 86400
    assert data['connected_clients'] == 3
    assert data['used_memory_human'] == '1.5M'
    assert 'latency_ms' in data

@patch('src.app.redis_url', 'redis://fake-host:6379')
@patch('src.app.redis')
def test_status_redis_connection_failure(mock_redis, client):
    """Verify /status returns 503 when Redis connection fails."""
    mock_redis.from_url.side_effect = ConnectionError("Connection refused")

    rv = client.get('/status')
    data = rv.get_json()

    assert rv.status_code == 503
    assert data['backend'] == 'redis'
    assert data['connected'] is False
    assert 'error' in data


def test_webhook_receive_not_configured(client):
    """Verify /webhook-receive returns 503 when secret not configured."""
    rv = client.post('/webhook-receive/any-secret',
        json={'event': 'test'},
        content_type='application/json')

    assert rv.status_code == 503
    data = rv.get_json()
    assert 'not configured' in data['error']


@patch('src.app.webhook_secret', 'test-secret-123')
def test_webhook_receive_invalid_secret(client):
    """Verify /webhook-receive returns 403 for invalid secret."""
    rv = client.post('/webhook-receive/wrong-secret',
        json={'event': 'test'},
        content_type='application/json')

    assert rv.status_code == 403
    data = rv.get_json()
    assert 'Invalid secret' in data['error']


@patch('src.app.webhook_secret', 'test-secret-123')
@patch('src.app.webhook_dns_target', 'example.com')
@patch('src.app.dns.resolver.resolve')
def test_webhook_receive_success(mock_dns, client):
    """Verify /webhook-receive performs DNS lookup and stores result."""
    # Mock DNS response
    mock_ip = Mock()
    mock_ip.to_text.return_value = '93.184.216.34'
    mock_dns.return_value = [mock_ip]

    rv = client.post('/webhook-receive/test-secret-123',
        json={'event': 'pomodoro_complete', 'duration': 25},
        content_type='application/json')

    assert rv.status_code == 200
    data = rv.get_json()
    assert data['status'] == 'received'
    assert data['dns_target'] == 'example.com'
    assert '93.184.216.34' in data['dns_records']
    assert data['dns_error'] is None


@patch('src.app.webhook_secret', 'test-secret-123')
@patch('src.app.webhook_dns_target', 'nonexistent.invalid')
@patch('src.app.dns.resolver.resolve')
def test_webhook_receive_dns_failure(mock_dns, client):
    """Verify /webhook-receive handles DNS failures gracefully."""
    mock_dns.side_effect = Exception("NXDOMAIN")

    rv = client.post('/webhook-receive/test-secret-123',
        json={'event': 'test'},
        content_type='application/json')

    assert rv.status_code == 200
    data = rv.get_json()
    assert data['status'] == 'received'
    assert data['dns_records'] == []
    assert 'NXDOMAIN' in data['dns_error']


def test_webhook_results_empty(client):
    """Verify /webhook-results returns empty list initially."""
    import src.app
    src.app._webhook_results_memory = []  # Reset memory storage

    rv = client.get('/webhook-results')

    assert rv.status_code == 200
    data = rv.get_json()
    assert data['count'] == 0
    assert data['results'] == []


def test_db_status_no_database_url(client):
    """Verify /db-status returns 'none' when no DATABASE_URL is configured."""
    rv = client.get('/db-status')
    data = rv.get_json()

    assert rv.status_code == 200
    assert data['backend'] == 'none'
    assert data['connected'] is False
    assert 'No DATABASE_URL configured' in data['message']


@patch('src.app.database_url', 'postgresql://test:test@localhost:5432/test')
@patch('src.app._use_postgres', False)
def test_db_status_init_failed(client):
    """Verify /db-status returns 503 when PostgreSQL init failed."""
    rv = client.get('/db-status')
    data = rv.get_json()

    assert rv.status_code == 503
    assert data['backend'] == 'postgres'
    assert data['connected'] is False
    assert 'initialization failed' in data['message']


@patch('src.app.database_url', 'postgresql://test:test@localhost:5432/test')
@patch('src.app._use_postgres', True)
@patch('src.app.get_db_session')
def test_db_status_connected(mock_get_session, client):
    """Verify /db-status returns PostgreSQL info when connected."""
    mock_session = MagicMock()
    mock_result = MagicMock()
    mock_result.scalar.return_value = 'PostgreSQL 16.1'
    mock_session.execute.return_value = mock_result
    mock_session.query.return_value.count.return_value = 5

    mock_get_session.return_value.__enter__ = Mock(return_value=mock_session)
    mock_get_session.return_value.__exit__ = Mock(return_value=False)

    rv = client.get('/db-status')
    data = rv.get_json()

    assert rv.status_code == 200
    assert data['backend'] == 'postgres'
    assert data['connected'] is True
    assert data['version'] == 'PostgreSQL 16.1'
    assert data['webhook_events_count'] == 5
    assert 'latency_ms' in data


@patch('src.app._use_postgres', True)
@patch('src.app._db_session_factory')
def test_store_webhook_postgres(mock_factory, client):
    """Verify webhook results are stored in PostgreSQL when available."""
    import src.app
    mock_session = MagicMock()
    mock_factory.return_value = mock_session

    result = {
        "timestamp": "2024-01-15T10:30:00Z",
        "event_type": "test",
        "source_ip": "127.0.0.1",
        "dns_target": "example.com",
        "dns_records": ["93.184.216.34"],
        "dns_error": None,
        "payload": {"event": "test"}
    }

    src.app._store_webhook_result(result)

    # Verify session.add was called with a WebhookEvent
    assert mock_session.add.called


@patch('src.app._use_postgres', True)
@patch('src.app._db_session_factory')
def test_get_webhook_results_postgres(mock_factory, client):
    """Verify webhook results are retrieved from PostgreSQL when available."""
    import src.app
    from src.models import WebhookEvent
    import uuid

    mock_session = MagicMock()
    mock_factory.return_value = mock_session

    # Create mock webhook event
    mock_event = MagicMock(spec=WebhookEvent)
    mock_event.id = uuid.uuid4()
    mock_event.timestamp = datetime(2024, 1, 15, 10, 30, 0, tzinfo=timezone.utc)
    mock_event.event_type = "test"
    mock_event.source_ip = "127.0.0.1"
    mock_event.dns_target = "example.com"
    mock_event.dns_records = ["93.184.216.34"]
    mock_event.dns_error = None
    mock_event.payload = {"event": "test"}

    mock_query = MagicMock()
    mock_query.order_by.return_value.limit.return_value.all.return_value = [mock_event]
    mock_session.query.return_value = mock_query

    results = src.app._get_webhook_results()

    assert len(results) == 1
    assert results[0]['event_type'] == 'test'
    assert results[0]['source_ip'] == '127.0.0.1'


def test_health_all_services_memory_fallback(client):
    """Verify /health returns all sections with memory fallback."""
    with patch('src.app._resolve_dns', return_value=(['1.2.3.4'], None)):
        rv = client.get('/health')
        data = rv.get_json()

    assert rv.status_code == 200
    assert 'app' in data
    assert 'valkey' in data
    assert 'postgres' in data
    assert 'opensearch' in data
    assert 'dns_canary' in data
    assert 'rate_limiter' in data
    assert data['valkey']['backend'] == 'memory'
    assert data['app']['git_sha'] is not None
    assert data['app']['python_version'] is not None
    assert data['app']['uptime_seconds'] >= 0


def test_health_dns_canary_success(client):
    """Verify /health dns_canary shows ok when DNS resolves."""
    with patch('src.app._resolve_dns', return_value=(['1.2.3.4'], None)):
        rv = client.get('/health')
        data = rv.get_json()

    assert data['dns_canary']['ok'] is True
    assert '1.2.3.4' in data['dns_canary']['records']
    assert data['dns_canary']['error'] is None


def test_health_dns_canary_failure(client):
    """Verify /health dns_canary shows ok=false when DNS fails."""
    with patch('src.app._resolve_dns', return_value=([], 'NXDOMAIN')):
        rv = client.get('/health')
        data = rv.get_json()

    assert data['dns_canary']['ok'] is False
    assert data['dns_canary']['records'] == []
    assert 'NXDOMAIN' in data['dns_canary']['error']


@patch('src.app._opensearch_url', 'https://user:pass@localhost:9200')
@patch('src.app._parse_opensearch_url')
def test_health_opensearch_connected(mock_parse, client):
    """Verify /health opensearch section when connected."""
    mock_parse.return_value = ('https', ('user', 'pass'), 'localhost', 9200)
    mock_client = MagicMock()
    mock_client.cluster.health.return_value = {
        'status': 'green',
        'number_of_nodes': 1,
    }
    with patch('src.app.OpenSearch', return_value=mock_client, create=True), \
         patch.dict('sys.modules', {'opensearchpy': MagicMock(OpenSearch=MagicMock(return_value=mock_client))}), \
         patch('src.app._resolve_dns', return_value=(['1.2.3.4'], None)):
        # Need to patch the import inside the function
        import importlib
        with patch('src.app._check_opensearch_health') as mock_os_health:
            mock_os_health.return_value = {
                'configured': True,
                'connected': True,
                'status': 'green',
                'number_of_nodes': 1,
                'latency_ms': 5.0,
            }
            rv = client.get('/health')
            data = rv.get_json()

    assert data['opensearch']['configured'] is True
    assert data['opensearch']['connected'] is True
    assert data['opensearch']['status'] == 'green'


def test_health_opensearch_not_configured(client):
    """Verify /health opensearch section when not configured."""
    with patch('src.app._resolve_dns', return_value=(['1.2.3.4'], None)):
        rv = client.get('/health')
        data = rv.get_json()

    assert data['opensearch']['configured'] is False
    assert data['opensearch']['status'] == 'not_configured'


def test_health_app_metadata(client):
    """Verify /health app section has correct metadata fields."""
    with patch('src.app._resolve_dns', return_value=(['1.2.3.4'], None)):
        rv = client.get('/health')
        data = rv.get_json()

    app_data = data['app']
    assert 'git_sha' in app_data
    assert 'python_version' in app_data
    assert 'uptime_seconds' in app_data
    # Python version should match format X.Y.Z
    parts = app_data['python_version'].split('.')
    assert len(parts) == 3


@patch('src.app.redis_url', 'redis://fake-host:6379')
@patch('src.app.redis')
def test_health_valkey_connected(mock_redis, client):
    """Verify /health valkey section when Redis is connected."""
    mock_conn = MagicMock()
    mock_conn.info.side_effect = lambda section="default": {
        "server": {"redis_version": "7.2.0", "uptime_in_seconds": 86400},
        "clients": {"connected_clients": 3},
        "memory": {"used_memory_human": "1.5M"},
    }.get(section, {})
    mock_redis.from_url.return_value = mock_conn

    with patch('src.app._resolve_dns', return_value=(['1.2.3.4'], None)):
        rv = client.get('/health')
        data = rv.get_json()

    assert data['valkey']['connected'] is True
    assert data['valkey']['version'] == '7.2.0'


@patch('src.app.redis_url', 'redis://fake-host:6379')
@patch('src.app.redis')
def test_health_valkey_failure(mock_redis, client):
    """Verify /health valkey section when Redis fails."""
    mock_redis.from_url.side_effect = ConnectionError("Connection refused")

    with patch('src.app._resolve_dns', return_value=(['1.2.3.4'], None)):
        rv = client.get('/health')
        data = rv.get_json()

    assert data['valkey']['connected'] is False
    assert 'error' in data['valkey']


def test_webhook_results_rss(client):
    """Verify /webhook-results/rss returns valid RSS XML."""
    import src.app
    src.app._webhook_results_memory = [{
        "id": "test-123",
        "timestamp": "2024-01-15T10:30:00Z",
        "event_type": "timer_complete",
        "source_ip": "127.0.0.1",
        "dns_target": "example.com",
        "dns_records": [],
        "dns_error": None,
        "payload": {"task": "Test task", "round": "pomodoro", "seconds": 1500}
    }]

    rv = client.get('/webhook-results/rss')

    assert rv.status_code == 200
    assert rv.content_type == 'application/rss+xml; charset=utf-8'
    data = rv.data.decode('utf-8')
    assert '<?xml version="1.0"' in data
    assert '<rss version="2.0">' in data
    assert '<title>CNNCT Webhook Events</title>' in data
    assert 'Pomodoro: Test task' in data
