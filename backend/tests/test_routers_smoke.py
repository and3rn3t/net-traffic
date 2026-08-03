"""Smoke tests: core GET endpoints respond via the real app lifespan."""


def test_health(api_client):
    response = api_client.get("/api/health")
    assert response.status_code == 200


def test_devices_list(api_client):
    response = api_client.get("/api/devices")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_flows_list(api_client):
    response = api_client.get("/api/flows")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_baselines_list(api_client):
    response = api_client.get("/api/baselines")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
