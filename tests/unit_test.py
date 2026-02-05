import pytest
from unittest.mock import patch, MagicMock, Mock
from src.app import app
import requests_mock

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

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

@patch('src.app.requests.post')
def test_webhook_success(mock_post, client):
    """Verify /webhook forwards payload and returns response data."""
    mock_response = Mock()
    mock_response.url = 'https://webhook.site/test'
    mock_response.status_code = 200
    mock_response.text = 'OK'
    mock_post.return_value = mock_response

    rv = client.post('/webhook',
        json={'url': 'https://webhook.site/test', 'payload': {'test': 'data'}},
        content_type='application/json')

    assert rv.status_code == 200
    data = rv.get_json()
    assert data['success'] == True
    assert data['http_code'] == 200
    assert data['webhook_url'] == 'https://webhook.site/test'
    assert 'total_time_ms' in data

@patch('src.app.requests.post')
def test_webhook_missing_url(mock_post, client):
    """Verify /webhook returns 400 when no URL is provided."""
    rv = client.post('/webhook',
        json={'payload': {'test': 'data'}},
        content_type='application/json')

    assert rv.status_code == 400
    data = rv.get_json()
    assert 'error' in data

@patch('src.app.requests.post')
def test_webhook_adds_https(mock_post, client):
    """Verify /webhook adds https:// when missing."""
    mock_response = Mock()
    mock_response.url = 'https://webhook.site/test'
    mock_response.status_code = 200
    mock_response.text = 'OK'
    mock_post.return_value = mock_response

    rv = client.post('/webhook',
        json={'url': 'webhook.site/test', 'payload': {}},
        content_type='application/json')

    assert rv.status_code == 200
    mock_post.assert_called_once()
    call_args = mock_post.call_args
    assert call_args[0][0] == 'https://webhook.site/test'


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
