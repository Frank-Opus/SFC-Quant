import json
import logging
from datetime import datetime, timezone

from app.core.config import Settings


class StructuredJsonFormatter(logging.Formatter):
    def __init__(self, *, app_name: str, app_env: str) -> None:
        super().__init__()
        self._app_name = app_name
        self._app_env = app_env

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname.lower(),
            "logger": record.name,
            "message": record.getMessage(),
            "app": self._app_name,
            "env": self._app_env,
        }
        context = getattr(record, "context", None)
        if isinstance(context, dict):
            payload.update(context)
        return json.dumps(payload, ensure_ascii=True)


def configure_logging(settings: Settings) -> None:
    root = logging.getLogger()
    root.handlers.clear()
    handler = logging.StreamHandler()
    handler.setFormatter(
        StructuredJsonFormatter(
            app_name=settings.app_name,
            app_env=settings.app_env,
        )
    )
    root.addHandler(handler)
    root.setLevel(logging.INFO)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
