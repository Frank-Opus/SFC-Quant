from fastapi import APIRouter, Request

from app.models.execution import (
    ExecutionControlRequest,
    ExecutionDispatchRequest,
    ExecutionDispatchResult,
    ExecutionStatusResponse,
)

router = APIRouter(prefix="/api/execution", tags=["execution"])


@router.get("/status", response_model=ExecutionStatusResponse)
async def get_execution_status(request: Request) -> ExecutionStatusResponse:
    return request.app.state.execution_service.status()


@router.post("/control", response_model=ExecutionStatusResponse)
async def control_execution(
    request: Request,
    payload: ExecutionControlRequest,
) -> ExecutionStatusResponse:
    service = request.app.state.execution_service
    if payload.action == "pause":
        return await service.pause(reason=payload.reason)
    return await service.resume()


@router.post("/dispatch", response_model=ExecutionDispatchResult)
async def dispatch_execution(
    request: Request,
    payload: ExecutionDispatchRequest,
) -> ExecutionDispatchResult:
    return await request.app.state.execution_service.dispatch(payload)
