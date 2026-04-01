from collections import deque
from datetime import datetime, timezone
from uuid import uuid4

from app.services.event_store import JsonlEventStore
from app.services.realtime import WebSocketHub
from app.models.events import EventEnvelope, EventType


class EventBus:
    def __init__(
        self,
        *,
        event_store: JsonlEventStore,
        websocket_hub: WebSocketHub,
        buffer_size: int,
    ) -> None:
        self._event_store = event_store
        self._websocket_hub = websocket_hub
        self._recent_events: deque[EventEnvelope] = deque(maxlen=buffer_size)

    @property
    def event_log_path(self) -> str:
        return str(self._event_store.path)

    async def publish(
        self,
        *,
        event_type: EventType,
        payload: dict,
        source: str = "backend",
    ) -> EventEnvelope:
        event = EventEnvelope(
            event_id=str(uuid4()),
            event_type=event_type,
            generated_at=datetime.now(timezone.utc),
            source=source,
            payload=payload,
        )
        self._recent_events.append(event)
        self._event_store.append(event)
        await self._websocket_hub.broadcast(event.model_dump(mode="json"))
        return event

    def get_recent_events(self, limit: int = 50) -> list[EventEnvelope]:
        recent = list(self._recent_events)[-limit:]
        if recent:
            return list(reversed(recent))

        stored = self._event_store.read_recent(limit=limit)
        return list(reversed(stored))

    async def connection_event(self) -> EventEnvelope:
        return EventEnvelope(
            event_id=str(uuid4()),
            event_type="system.connected",
            generated_at=datetime.now(timezone.utc),
            payload={
                "connections": self._websocket_hub.connection_count,
                "event_log_path": self.event_log_path,
            },
        )
