from fastapi import APIRouter, Request

from app.models.risk import LiveModeRequest, RiskHaltRequest, RiskPolicyUpdateRequest, RiskStatusResponse

router = APIRouter(prefix="/api/risk", tags=["risk"])


@router.get("/status", response_model=RiskStatusResponse)
async def get_risk_status(request: Request) -> RiskStatusResponse:
    return request.app.state.risk_service.status()


@router.post("/policy", response_model=RiskStatusResponse)
async def update_risk_policy(
    request: Request,
    payload: RiskPolicyUpdateRequest,
) -> RiskStatusResponse:
    return await request.app.state.risk_service.update_policy(payload)


@router.post("/halt", response_model=RiskStatusResponse)
async def control_risk_halt(
    request: Request,
    payload: RiskHaltRequest,
) -> RiskStatusResponse:
    service = request.app.state.risk_service
    if payload.action == "halt":
        return await service.set_halt(payload.reason)
    return await service.clear_halt()


@router.post("/live-mode", response_model=RiskStatusResponse)
async def control_live_mode(
    request: Request,
    payload: LiveModeRequest,
) -> RiskStatusResponse:
    return await request.app.state.risk_service.request_live_mode(payload)
