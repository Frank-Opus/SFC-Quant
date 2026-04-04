from functools import lru_cache
from urllib.parse import urlparse

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
    finnhub_api_key: str | None = None
    fred_api_key: str | None = None
    eia_api_key: str | None = None
    coingecko_api_key: str | None = None
    external_intel_cache_ttl_seconds: float = 300.0
    external_intel_news_limit: int = 5

    strategy_factory_enabled: bool = False
    strategy_factory_provider: str = "mock_rdq"
    strategy_factory_workspace: str = "./var/strategy_factory"
    strategy_factory_auto_generate: bool = False
    strategy_factory_rd_agent_command: str = "rdagent fin_quant"
    strategy_factory_rd_agent_timeout_seconds: float = 900.0
    strategy_factory_tradingagents_command: str = "tradingagents"
    strategy_factory_tradingagents_timeout_seconds: float = 900.0

    exchange_id: str = "binance"
    exchange_api_key: str | None = None
    exchange_api_secret: str | None = None
    market_data_mode: str = "real"

    execution_mode: str = "paper"
    execution_adapter: str = "freqtrade_mock"
    execution_freqtrade_rest_base_url: str | None = None
    execution_freqtrade_rest_username: str | None = None
    execution_freqtrade_rest_password: str | None = None
    execution_freqtrade_rest_timeout_seconds: float = 10.0
    execution_freqtrade_rest_order_type: str = "market"
    execution_engine_start_paused: bool = False
    execution_paper_starting_balance: float = 10000.0
    execution_order_notional_usd: float = 500.0
    execution_fee_rate: float = 0.001
    execution_max_recent_orders: int = 50

    risk_max_position_notional_usd: float = 1000.0
    risk_max_concurrent_trades: int = 3
    risk_daily_loss_limit_usd: float = 250.0
    risk_blocked_symbols: list[str] = Field(default_factory=list)
    risk_require_agent_approval: bool = True
    risk_min_approval_confidence: float = 0.55

    frontend_api_url: str = Field(default="http://backend:8000")
    frontend_ws_url: str = Field(default="ws://backend:8000/ws")
    cors_allowed_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:4173",
            "http://127.0.0.1:4173",
        ]
    )
    cors_allowed_origin_regex: str | None = r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$"

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

    @field_validator("strategy_factory_provider", mode="before")
    @classmethod
    def normalize_strategy_provider(cls, value: str) -> str:
        return str(value).strip().lower()

    @field_validator("execution_mode", mode="before")
    @classmethod
    def normalize_execution_mode(cls, value: str) -> str:
        normalized = str(value).strip().lower()
        if normalized in {"paper", "dry_run", "dry-run"}:
            return "paper"
        raise ValueError("execution_mode must remain paper for this release profile")

    @field_validator("execution_adapter", mode="before")
    @classmethod
    def normalize_execution_adapter(cls, value: str) -> str:
        normalized = str(value).strip().lower()
        if normalized in {"mock", "freqtrade_mock"}:
            return "freqtrade_mock"
        if normalized in {"freqtrade_rest", "freqtrade_rest_paper", "freqtrade_paper"}:
            return "freqtrade_rest_paper"
        raise ValueError(
            "execution_adapter must be one of: freqtrade_mock, freqtrade_rest_paper"
        )

    @field_validator(
        "execution_freqtrade_rest_base_url",
        "execution_freqtrade_rest_username",
        "execution_freqtrade_rest_password",
        "finnhub_api_key",
        "fred_api_key",
        "eia_api_key",
        "coingecko_api_key",
        mode="before",
    )
    @classmethod
    def normalize_optional_execution_fields(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = str(value).strip()
        return normalized or None

    @field_validator("execution_freqtrade_rest_base_url")
    @classmethod
    def validate_execution_freqtrade_rest_base_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        parsed = urlparse(value)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError(
                "execution_freqtrade_rest_base_url must be a valid http(s) URL"
            )
        return value.rstrip("/")

    @field_validator("execution_freqtrade_rest_timeout_seconds")
    @classmethod
    def validate_execution_freqtrade_rest_timeout(cls, value: float) -> float:
        if value <= 0:
            raise ValueError("execution_freqtrade_rest_timeout_seconds must be positive")
        return value

    @field_validator("external_intel_cache_ttl_seconds")
    @classmethod
    def validate_external_intel_cache_ttl(cls, value: float) -> float:
        if value <= 0:
            raise ValueError("external_intel_cache_ttl_seconds must be positive")
        return value

    @field_validator("external_intel_news_limit")
    @classmethod
    def validate_external_intel_news_limit(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("external_intel_news_limit must be positive")
        return value

    @field_validator("execution_freqtrade_rest_order_type", mode="before")
    @classmethod
    def normalize_execution_order_type(cls, value: str) -> str:
        normalized = str(value).strip().lower()
        if normalized not in {"market", "limit"}:
            raise ValueError("execution_freqtrade_rest_order_type must be market or limit")
        return normalized

    @field_validator("market_data_mode", mode="before")
    @classmethod
    def normalize_market_data_mode(cls, value: str) -> str:
        normalized = str(value).strip().lower()
        if normalized in {"real", "live", "ccxt"}:
            return "real"
        if normalized in {"mock", "safe", "simulated"}:
            return "mock"
        raise ValueError("market_data_mode must be one of: mock, real")

    @field_validator("cors_allowed_origins", mode="before")
    @classmethod
    def normalize_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, list):
            return [item.strip() for item in value if item.strip()]
        return [item.strip() for item in str(value).split(",") if item.strip()]

    @field_validator("market_symbols", "market_timeframes", "risk_blocked_symbols", mode="before")
    @classmethod
    def normalize_csv_lists(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, list):
            return [item.strip() for item in value if item.strip()]
        return [item.strip() for item in str(value).split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
