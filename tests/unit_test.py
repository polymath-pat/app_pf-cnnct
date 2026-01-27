import pytest
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
