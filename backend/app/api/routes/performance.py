from fastapi import APIRouter, Request

from app.models.performance import PerformanceReport

router = APIRouter(prefix="/api/performance", tags=["performance"])


@router.get("/paper", response_model=PerformanceReport)
async def get_paper_performance(request: Request) -> PerformanceReport:
    return request.app.state.performance_service.paper_report()
