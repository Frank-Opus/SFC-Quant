from logging import getLogger
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.analysis import router as analysis_router
from app.api.routes.diagnostics import router as diagnostics_router
from app.api.routes.execution import router as execution_router
from app.api.routes.events import router as events_router
from app.api.routes.health import router as health_router
from app.api.routes.market import router as market_router
from app.api.routes.risk import router as risk_router
from app.api.routes.realtime import router as realtime_router
from app.api.routes.strategy import router as strategy_router
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.core.runtime import resolve_runtime
from app.services.event_store import JsonlEventStore
from app.services.analysis import AnalysisService
from app.services.event_bus import EventBus
from app.services.execution import ExecutionService
from app.services.market import MarketRuntimeService
from app.services.providers import ProviderFactory
from app.services.risk import RiskService
from app.services.realtime import WebSocketHub
from app.services.strategy_factory import StrategyFactoryService

logger = getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    configure_logging(settings)
    logger.info(
        "app_starting",
        extra={"context": {"service": "backend", "app_mode": settings.app_mode}},
    )
    websocket_hub = WebSocketHub()
    event_store = JsonlEventStore(settings.event_log_dir)
    event_bus = EventBus(
        event_store=event_store,
        websocket_hub=websocket_hub,
        buffer_size=settings.market_event_buffer_size,
    )
    market_service = MarketRuntimeService(
        settings=settings,
        event_bus=event_bus,
    )
    analysis_service = AnalysisService(
        settings=settings,
        market_service=market_service,
        event_bus=event_bus,
        provider_factory=ProviderFactory(settings),
    )
    execution_service = ExecutionService(
        settings=settings,
        analysis_service=analysis_service,
        event_bus=event_bus,
    )
    risk_service = RiskService(
        settings=settings,
        event_bus=event_bus,
        pause_execution=execution_service.pause,
    )
    strategy_factory_service = StrategyFactoryService(
        settings=settings,
        event_bus=event_bus,
        analysis_service=analysis_service,
    )
    execution_service.set_risk_service(risk_service)

    app.state.websocket_hub = websocket_hub
    app.state.settings = settings
    app.state.event_bus = event_bus
    app.state.market_service = market_service
    app.state.analysis_service = analysis_service
    app.state.execution_service = execution_service
    app.state.risk_service = risk_service
    app.state.strategy_factory_service = strategy_factory_service

    await market_service.initialize()
    await analysis_service.initialize()
    await execution_service.initialize()
    await risk_service.initialize()
    await strategy_factory_service.initialize()
    try:
        yield
    finally:
        logger.info("app_stopping", extra={"context": {"service": "backend"}})
        await market_service.shutdown()

app = FastAPI(
    title="dSFC-Quant Backend",
    version="0.1.0",
    summary="Local-first FastAPI control plane for dSFC-Quant.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_allowed_origins,
    allow_origin_regex=get_settings().cors_allowed_origin_regex,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(diagnostics_router)
app.include_router(market_router)
app.include_router(events_router)
app.include_router(analysis_router)
app.include_router(execution_router)
app.include_router(risk_router)
app.include_router(realtime_router)
app.include_router(strategy_router)


@app.get("/")
def root() -> dict[str, object]:
    settings = get_settings()
    runtime = resolve_runtime(settings).model_dump()
    runtime["entrypoint"] = "root"
    runtime["market_stream"] = {
        "symbols": settings.market_symbols,
        "timeframes": settings.market_timeframes,
        "event_log_dir": settings.event_log_dir,
    }
    runtime["strategy_factory"] = {
        "enabled": settings.strategy_factory_enabled,
        "provider": settings.strategy_factory_provider,
        "workspace": settings.strategy_factory_workspace,
    }
    return runtime
