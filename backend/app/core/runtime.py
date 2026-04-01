from pydantic import BaseModel

from app.core.config import Settings


class RuntimeSnapshot(BaseModel):
    name: str
    service: str
    status: str
    app_env: str
    app_mode: str
    runtime_mode: str
    ai_provider: str
    ai_model: str | None
    exchange_id: str
    execution_mode: str
    execution_adapter: str
    ai_credentials_present: bool
    exchange_credentials_present: bool
    live_trading_requested: bool
    live_trading_enabled: bool
    warnings: list[str]


def resolve_runtime(settings: Settings) -> RuntimeSnapshot:
    warnings: list[str] = []

    exchange_credentials_present = bool(
        settings.exchange_api_key and settings.exchange_api_secret
    )
    ai_credentials_present = settings.ai_provider == "mock" or bool(
        settings.ai_api_key and settings.ai_base_url and settings.ai_model
    )
    live_trading_requested = settings.live_trading_enabled
    live_trading_enabled = False

    if settings.app_mode == "mock":
        runtime_mode = "mock-safe"
        if live_trading_requested:
            warnings.append(
                "LIVE_TRADING_ENABLED requested while APP_MODE=mock; forcing live trading off."
            )
    elif exchange_credentials_present:
        runtime_mode = "paper-ready"
        if live_trading_requested:
            runtime_mode = "live-enabled"
            live_trading_enabled = True
    else:
        runtime_mode = "credentials-missing"
        if live_trading_requested:
            warnings.append(
                "Live trading requested without exchange credentials; forcing live trading off."
            )

    if settings.ai_provider != "mock":
        missing_fields: list[str] = []
        if not settings.ai_api_key:
            missing_fields.append("AI_API_KEY")
        if not settings.ai_base_url:
            missing_fields.append("AI_BASE_URL")
        if not settings.ai_model:
            missing_fields.append("AI_MODEL")
        if missing_fields:
            warnings.append(
                f"AI provider '{settings.ai_provider}' is configured without {', '.join(missing_fields)}; backend remains in safe startup mode."
            )

    return RuntimeSnapshot(
        name=settings.app_name,
        service="backend",
        status="ok",
        app_env=settings.app_env,
        app_mode=settings.app_mode,
        runtime_mode=runtime_mode,
        ai_provider=settings.ai_provider,
        ai_model=settings.ai_model,
        exchange_id=settings.exchange_id,
        execution_mode=settings.execution_mode,
        execution_adapter=settings.execution_adapter,
        ai_credentials_present=ai_credentials_present,
        exchange_credentials_present=exchange_credentials_present,
        live_trading_requested=live_trading_requested,
        live_trading_enabled=live_trading_enabled,
        warnings=warnings,
    )
