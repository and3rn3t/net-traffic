"""Shared pytest fixtures for the backend test suite."""
import os
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

# Config() validates at import time (utils/config.py), so these must be set
# before anything imports it - conftest.py is guaranteed to run first.
os.environ.setdefault("CAPTURE_MODE", "local")
os.environ.setdefault("NETWORK_INTERFACE", "lo")
os.environ.setdefault("DEFAULT_ADMIN_PASSWORD", "TestPassword123")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-not-for-production")
os.environ.setdefault("USE_JSON_LOGGING", "false")

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient

from services.storage import StorageService


@pytest_asyncio.fixture
async def storage(tmp_path):
    """Fresh StorageService (connection pool enabled) backed by a temp sqlite file."""
    svc = StorageService(db_path=str(tmp_path / "test.db"), use_pool=True)
    await svc.initialize()
    yield svc
    await svc.close()


@pytest.fixture
def api_client(tmp_path, monkeypatch):
    """TestClient running the real app lifespan against an isolated temp DB."""
    monkeypatch.setenv("DB_PATH", str(tmp_path / "app.db"))
    from main import app

    with TestClient(app) as client:
        yield client
