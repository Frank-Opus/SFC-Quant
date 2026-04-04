from fastapi import APIRouter, Request

from app.models.performance import BacktestRunRequest, PerformanceReport

router = APIRouter(prefix="/api/backtest", tags=["backtest"])


@router.post("/run", response_model=PerformanceReport)
async def run_backtest(
    request: Request,
    payload: BacktestRunRequest,
) -> PerformanceReport:
    return await request.app.state.performance_service.run_backtest(payload)
