from fastapi import APIRouter, Request

from app.models.analysis import AnalysisRunRequest, AnalysisRunResult

router = APIRouter(prefix="/api/analysis", tags=["analysis"])


@router.post("/run", response_model=AnalysisRunResult)
async def run_analysis(request: Request, payload: AnalysisRunRequest) -> AnalysisRunResult:
    return await request.app.state.analysis_service.run_analysis(payload, trigger="manual")


@router.get("/latest", response_model=AnalysisRunResult | None)
async def get_latest_analysis(
    request: Request,
    symbol: str,
    timeframe: str = "1m",
) -> AnalysisRunResult | None:
    result = request.app.state.analysis_service.latest_analysis(
        symbol=symbol,
        timeframe=timeframe,
    )
    return result
