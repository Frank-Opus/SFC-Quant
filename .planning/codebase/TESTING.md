# Testing Patterns

**Analysis Date:** 2026-04-01

## Test Framework

**Runner:**
- `pytest` `>=8.4.0,<9.0.0`
- Config: `backend/pyproject.toml`

**Assertion Library:**
- Built-in `pytest` assertions with `fastapi.testclient.TestClient` for HTTP checks in `backend/tests/test_health.py`

**Run Commands:**
```bash
cd backend && pytest -q        # Run all detected backend tests
# Watch mode: Not configured
# Coverage: Not configured
```

## Test File Organization

**Location:**
- Backend tests live in `backend/tests/`.
- No frontend test directory or frontend test runner is detected under `frontend/`.

**Naming:**
- Use `test_*.py` filenames, as shown by `backend/tests/test_health.py`.

**Structure:**
```text
backend/
└── tests/
    ├── __init__.py
    └── test_health.py
```

## Test Structure

**Suite Organization:**
```python
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app


def test_health_reports_mock_safe_defaults(monkeypatch) -> None:
    for key in (...):
        monkeypatch.delenv(key, raising=False)

    get_settings.cache_clear()

    client = TestClient(app)
    response = client.get("/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["runtime_mode"] == "mock-safe"

    get_settings.cache_clear()
```

**Patterns:**
- Use one test function per behavior slice, as shown by `backend/tests/test_health.py`.
- Build requests against the real FastAPI app object from `backend/app/main.py` instead of calling route helpers directly.
- Reset cached settings before and after tests that mutate environment-driven config, using `get_settings.cache_clear()` from `backend/app/core/config.py`.
- Assert individual JSON fields directly instead of snapshotting full payloads, as shown in `backend/tests/test_health.py`.

## Mocking

**Framework:** `pytest` built-in `monkeypatch` fixture

**Patterns:**
```python
for key in (
    "APP_MODE",
    "LIVE_TRADING_ENABLED",
    "AI_PROVIDER",
    "AI_API_KEY",
    "EXCHANGE_API_KEY",
    "EXCHANGE_API_SECRET",
):
    monkeypatch.delenv(key, raising=False)

get_settings.cache_clear()
```

**What to Mock:**
- Mock environment variables that influence `backend/app/core/config.py` and `backend/app/core/runtime.py`.
- Mock configuration state at the boundary where runtime behavior is derived, not inside FastAPI route wiring.

**What NOT to Mock:**
- Do not mock the FastAPI application object in `backend/app/main.py`; use the real app with `TestClient`.
- Do not mock the `/health` route return shape when validating the HTTP contract in `backend/tests/test_health.py`.

## Fixtures and Factories

**Test Data:**
```python
payload = response.json()
assert payload["name"] == "dSFC-Quant"
assert payload["status"] == "ok"
assert payload["service"] == "backend"
assert payload["live_trading_enabled"] is False
```

**Location:**
- Test data is currently inline within `backend/tests/test_health.py`.
- No shared fixtures, fixture modules, or factory helpers are detected in `backend/tests/`.

## Coverage

**Requirements:** None enforced

**View Coverage:**
```bash
# No coverage command or threshold is configured in `backend/pyproject.toml` or `frontend/package.json`
```

## Test Types

**Unit Tests:**
- The current suite validates backend runtime resolution through the `/health` HTTP surface in `backend/tests/test_health.py`.
- This is closer to a lightweight service-level unit/smoke test than a pure function test because it instantiates `TestClient(app)`.

**Integration Tests:**
- Not detected for Docker Compose startup, WebSocket flows, exchange adapters, or frontend rendering.

**E2E Tests:**
- Not used; no Playwright, Cypress, Vitest browser tests, or equivalent tooling is detected.

## Common Patterns

**Async Testing:**
```python
# Not detected in the current repository.
# Existing tests use synchronous `fastapi.testclient.TestClient`.
```

**Error Testing:**
```python
# Not detected in the current repository.
# `backend/tests/test_health.py` covers the default happy-path contract only.
```

---

*Testing analysis: 2026-04-01*
