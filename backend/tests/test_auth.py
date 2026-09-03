"""Health is open; everything under /api/syllabus needs the key."""

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("API_KEY", "test-key")
    monkeypatch.setenv("MONGODB_URI", "")
    get_settings.cache_clear()
    from app.main import create_app

    with TestClient(create_app()) as c:
        yield c
    get_settings.cache_clear()


def test_health_needs_no_key(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "degraded"  # no MONGODB_URI in tests


def test_health_is_also_mounted_under_api(client):
    assert client.get("/api/health").status_code == 200


def test_protected_route_rejects_a_missing_key(client):
    assert client.get("/api/auth/check").status_code == 401


def test_protected_route_rejects_a_wrong_key(client):
    response = client.get("/api/auth/check", headers={"X-API-Key": "nope"})
    assert response.status_code == 401


def test_protected_route_accepts_the_right_key(client):
    response = client.get("/api/auth/check", headers={"X-API-Key": "test-key"})
    assert response.status_code == 200
    assert response.json() == {"ok": True}


def test_unconfigured_database_returns_503_not_500(client):
    """Without MONGODB_URI the app must still answer, so CORS headers survive."""
    response = client.get("/api/syllabus/subjects", headers={"X-API-Key": "test-key"})
    assert response.status_code == 503
