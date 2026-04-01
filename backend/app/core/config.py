from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "dSFC-Quant"
    app_env: str = "development"
    app_mode: str = "mock"
    live_trading_enabled: bool = False

    ai_provider: str = "mock"
    ai_api_key: str | None = None
    ai_base_url: str | None = None
    ai_model: str | None = "gpt-5.4"
    ai_timeout_seconds: float = 30.0

    exchange_id: str = "binance"
    exchange_api_key: str | None = None
    exchange_api_secret: str | None = None

    execution_mode: str = "paper"
    execution_adapter: str = "freqtrade_mock"
    execution_engine_start_paused: bool = False
    execution_paper_starting_balance: float = 10000.0
    execution_order_notional_usd: float = 500.0
    execution_fee_rate: float = 0.001
    execution_max_recent_orders: int = 50

    frontend_api_url: str = Field(default="http://backend:8000")
    frontend_ws_url: str = Field(default="ws://backend:8000/ws")
    cors_allowed_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ]
    )

    market_symbols: list[str] = Field(default_factory=lambda: ["BTC/USDT", "ETH/USDT"])
    market_timeframes: list[str] = Field(default_factory=lambda: ["1m", "5m"])
    market_history_limit: int = 24
    market_poll_interval_seconds: float = 3.0
    market_event_buffer_size: int = 100
    market_stream_enabled: bool = True
    event_log_dir: str = "./var/events"

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        enable_decoding=False,
        extra="ignore",
    )

    @field_validator("app_mode", mode="before")
    @classmethod
    def normalize_app_mode(cls, value: str) -> str:
        return str(value).strip().lower()

    @field_validator("ai_provider", mode="before")
    @classmethod
    def normalize_ai_provider(cls, value: str) -> str:
        return str(value).strip().lower()

    @field_validator("execution_mode", "execution_adapter", mode="before")
    @classmethod
    def normalize_execution_fields(cls, value: str) -> str:
        return str(value).strip().lower()

    @field_validator("cors_allowed_origins", mode="before")
    @classmethod
    def normalize_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, list):
            return [item.strip() for item in value if item.strip()]
        return [item.strip() for item in str(value).split(",") if item.strip()]

    @field_validator("market_symbols", "market_timeframes", mode="before")
    @classmethod
    def normalize_csv_lists(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, list):
            return [item.strip() for item in value if item.strip()]
        return [item.strip() for item in str(value).split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
