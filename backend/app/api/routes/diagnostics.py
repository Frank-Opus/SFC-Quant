from collections import Counter
from datetime import datetime, timezone

from fastapi import APIRouter, Request

from app.core.config import get_settings
from app.core.runtime import resolve_runtime
from app.models.diagnostics import DiagnosticsSummaryResponse

router = APIRouter(prefix="/api/diagnostics", tags=["diagnostics"])


@router.get("/summary", response_model=DiagnosticsSummaryResponse)
async def get_diagnostics_summary(request: Request) -> DiagnosticsSummaryResponse:
    settings = getattr(request.app.state, "settings", get_settings())
    event_bus = request.app.state.event_bus
    market_service = request.app.state.market_service
    websocket_hub = request.app.state.websocket_hub
    execution_service = request.app.state.execution_service
    risk_service = request.app.state.risk_service
    strategy_factory_service = request.app.state.strategy_factory_service

    market_data = market_service.status()
    runtime = resolve_runtime(settings, market_data=market_data)
    recent_events = event_bus.get_recent_events(limit=50)
    event_counts = Counter(event.event_type for event in recent_events)
    recent_warnings = [
        str(event.payload.get("message", "warning"))
        for event in recent_events
        if event.event_type == "system.warning"
    ]
    recent_warnings.extend(runtime.warnings)

    return DiagnosticsSummaryResponse(
        generated_at=datetime.now(timezone.utc),
        runtime=runtime,
        market_data=market_data,
        websocket_connections=websocket_hub.connection_count,
        event_log_path=event_bus.event_log_path,
        recent_event_counts=dict(event_counts),
        recent_warnings=list(dict.fromkeys(recent_warnings))[:8],
        execution=execution_service.status(),
        risk=risk_service.status(),
        strategy=strategy_factory_service.status(),
    )
