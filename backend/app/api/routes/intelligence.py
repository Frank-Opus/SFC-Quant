from fastapi import APIRouter, Request

from app.models.intelligence import IntelligenceSnapshotResponse

router = APIRouter(prefix="/api/intelligence", tags=["intelligence"])


@router.get("/macro", response_model=IntelligenceSnapshotResponse)
async def get_macro_intelligence(
    request: Request,
    symbol: str = "BTC/USDT",
    timeframe: str = "1m",
) -> IntelligenceSnapshotResponse:
    return await request.app.state.intelligence_service.snapshot(
        symbol=symbol,
        timeframe=timeframe,
    )
