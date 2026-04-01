from fastapi import FastAPI

from app.api.routes.health import router as health_router
from app.core.config import get_settings
from app.core.runtime import resolve_runtime

app = FastAPI(
    title="dSFC-Quant Backend",
    version="0.1.0",
    summary="Local-first FastAPI control plane for dSFC-Quant.",
)

app.include_router(health_router)


@app.get("/")
def root() -> dict[str, object]:
    runtime = resolve_runtime(get_settings()).model_dump()
    runtime["entrypoint"] = "root"
    return runtime
