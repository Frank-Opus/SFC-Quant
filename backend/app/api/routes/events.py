from fastapi import APIRouter, Query, Request

from app.models.events import EventEnvelope

router = APIRouter(prefix="/api/events", tags=["events"])


@router.get("/recent", response_model=list[EventEnvelope])
async def get_recent_events(
    request: Request,
    limit: int = Query(default=25, ge=1, le=100),
) -> list[EventEnvelope]:
    return request.app.state.event_bus.get_recent_events(limit=limit)
