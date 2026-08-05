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


def test_dns_stats(api_client):
    response = api_client.get("/api/stats/dns")
    assert response.status_code == 200
    body = response.json()
    assert "total_queries" in body
    assert "top_domains" in body
    assert "unusual_tlds" in body


def test_device_presence(api_client):
    response = api_client.get("/api/stats/device-presence")
    assert response.status_code == 200
    body = response.json()
    assert "days" in body
    assert "hours" in body
    assert "devices" in body


def test_latency_quality_calendar(api_client):
    response = api_client.get("/api/stats/latency-calendar")
    assert response.status_code == 200
    body = response.json()
    assert "days" in body
    assert "day_labels" in body
    assert len(body["day_labels"]) == 7
    assert len(body["cells"]) == 7
    assert len(body["cells"][0]) == 24
