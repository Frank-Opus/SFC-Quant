from fastapi import FastAPI

from app.api.routes.health import router as health_router

app = FastAPI(
    title="dSFC-Quant Backend",
    version="0.1.0",
    summary="Local-first FastAPI control plane for dSFC-Quant.",
)

app.include_router(health_router)


@app.get("/")
def root() -> dict[str, str]:
    return {
        "name": "dSFC-Quant",
        "service": "backend",
        "runtime_mode": "phase-1-safe-shell",
    }

