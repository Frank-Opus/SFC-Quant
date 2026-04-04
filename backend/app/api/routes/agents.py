from fastapi import APIRouter, Request

from app.models.strategy import AgentRuntimeSummaryResponse

router = APIRouter(prefix="/api/agents", tags=["agents"])


@router.get("/runtime", response_model=AgentRuntimeSummaryResponse)
async def get_agent_runtime(request: Request) -> AgentRuntimeSummaryResponse:
    return request.app.state.strategy_factory_service.agent_runtime()
