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

    exchange_id: str = "binance"
    exchange_api_key: str | None = None
    exchange_api_secret: str | None = None

    frontend_api_url: str = Field(default="http://backend:8000")
    frontend_ws_url: str = Field(default="ws://backend:8000/ws")

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
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


@lru_cache
def get_settings() -> Settings:
    return Settings()

