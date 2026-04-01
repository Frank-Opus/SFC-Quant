from fastapi import APIRouter, HTTPException, Query, Request

from app.models.strategy import (
    StrategyArtifact,
    StrategyFactoryConfigRequest,
    StrategyFactoryStatusResponse,
    StrategyGenerationRequest,
    StrategyGenerationResponse,
)

router = APIRouter(prefix="/api/strategy", tags=["strategy"])


@router.get("/status", response_model=StrategyFactoryStatusResponse)
async def get_strategy_status(request: Request) -> StrategyFactoryStatusResponse:
    return request.app.state.strategy_factory_service.status()


@router.post("/config", response_model=StrategyFactoryStatusResponse)
async def update_strategy_config(
    request: Request,
    payload: StrategyFactoryConfigRequest,
) -> StrategyFactoryStatusResponse:
    return await request.app.state.strategy_factory_service.update_config(payload)


@router.get("/artifacts", response_model=list[StrategyArtifact])
async def list_strategy_artifacts(
    request: Request,
    symbol: str | None = None,
    timeframe: str | None = None,
    limit: int = Query(default=10, ge=1, le=50),
) -> list[StrategyArtifact]:
    return request.app.state.strategy_factory_service.list_artifacts(
        symbol=symbol,
        timeframe=timeframe,
        limit=limit,
    )


@router.post("/generate", response_model=StrategyGenerationResponse)
async def generate_strategy_artifact(
    request: Request,
    payload: StrategyGenerationRequest,
) -> StrategyGenerationResponse:
    try:
        return await request.app.state.strategy_factory_service.generate(payload)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
