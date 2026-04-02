from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Request

from app.core.config import get_settings
from app.core.runtime import resolve_runtime
from app.models.diagnostics import HealthCheck, HealthStatusResponse

router = APIRouter(tags=["health"])


@router.get("/health")
def healthcheck(request: Request) -> dict[str, object]:
    settings = getattr(request.app.state, "settings", get_settings())
    market_service = getattr(request.app.state, "market_service", None)
    market_data = market_service.status() if market_service else None
    return resolve_runtime(settings, market_data=market_data).model_dump()


@router.get("/health/live")
def liveness_probe() -> dict[str, str]:
    return {
        "service": "backend",
        "status": "ok",
    }


@router.get("/health/ready", response_model=HealthStatusResponse)
def readiness_probe(request: Request) -> HealthStatusResponse:
    settings = getattr(request.app.state, "settings", get_settings())
    market_service = request.app.state.market_service
    market_data = market_service.status()
    runtime = resolve_runtime(settings, market_data=market_data)
    event_log_path = Path(request.app.state.event_bus.event_log_path)
    event_log_path.parent.mkdir(parents=True, exist_ok=True)
    market_snapshot = market_service.snapshot_response()
    market_check_status = "ok" if market_data.status in {"mock", "live"} else "degraded"

    checks = [
        HealthCheck(
            name="event_log_directory",
            status="ok" if event_log_path.parent.exists() else "degraded",
            detail=str(event_log_path.parent),
        ),
        HealthCheck(
            name="market_snapshots",
            status=market_check_status if market_snapshot.snapshots else "degraded",
            detail=(
                market_data.detail
                if market_snapshot.snapshots
                else "No snapshots loaded yet."
            ),
        ),
        HealthCheck(
            name="strategy_workspace",
            status=(
                "ok"
                if Path(request.app.state.strategy_factory_service.status().workspace).exists()
                else "degraded"
            ),
            detail=request.app.state.strategy_factory_service.status().workspace,
        ),
    ]
    status = "ok" if all(check.status == "ok" for check in checks) else "degraded"
    return HealthStatusResponse(
        status=status,
        generated_at=datetime.now(timezone.utc),
        runtime=runtime,
        checks=checks,
    )
