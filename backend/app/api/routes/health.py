from fastapi import APIRouter

from app.core.config import get_settings
from app.core.runtime import resolve_runtime

router = APIRouter(tags=["health"])


@router.get("/health")
def healthcheck() -> dict[str, object]:
    return resolve_runtime(get_settings()).model_dump()
