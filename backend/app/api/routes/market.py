from fastapi import APIRouter, Request

from app.models.events import MarketSnapshotResponse

router = APIRouter(prefix="/api/market", tags=["market"])


@router.get("/snapshot", response_model=MarketSnapshotResponse)
async def get_market_snapshot(request: Request) -> MarketSnapshotResponse:
    return request.app.state.market_service.snapshot_response()
