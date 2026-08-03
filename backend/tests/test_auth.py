"""Auth flow: default admin login, token validation, guarded-route 401."""


def test_login_with_default_admin_succeeds(api_client):
    response = api_client.post(
        "/api/auth/login",
        data={"username": "admin", "password": "TestPassword123"},
    )
    assert response.status_code == 200
    body = response.json()
    assert "access_token" in body


def test_login_with_wrong_password_returns_401(api_client):
    response = api_client.post(
        "/api/auth/login",
        data={"username": "admin", "password": "WrongPassword123"},
    )
    assert response.status_code == 401


def test_me_without_token_returns_401(api_client):
    response = api_client.get("/api/auth/me")
    assert response.status_code == 401


def test_me_with_valid_token_returns_user(api_client):
    login = api_client.post(
        "/api/auth/login",
        data={"username": "admin", "password": "TestPassword123"},
    )
    token = login.json()["access_token"]

    response = api_client.get(
        "/api/auth/me", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200
    assert response.json()["username"] == "admin"
