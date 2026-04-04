from fastapi import APIRouter, Request

from app.models.workflow import WorkflowSnapshotResponse

router = APIRouter(prefix="/api/workflow", tags=["workflow"])


@router.get("/snapshot", response_model=WorkflowSnapshotResponse)
async def get_workflow_snapshot(
    request: Request,
    symbol: str | None = None,
    timeframe: str | None = None,
) -> WorkflowSnapshotResponse:
    return await request.app.state.workflow_service.snapshot(
        symbol=symbol,
        timeframe=timeframe,
    )
