import asyncio
from collections.abc import Iterable

from fastapi import WebSocket


class WebSocketHub:
    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()
        self._lock = asyncio.Lock()

    @property
    def connection_count(self) -> int:
        return len(self._connections)

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections.add(websocket)

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            self._connections.discard(websocket)

    async def send_personal_message(self, websocket: WebSocket, message: dict) -> None:
        await websocket.send_json(message)

    async def broadcast(self, message: dict) -> None:
        async with self._lock:
            recipients = list(self._connections)

        stale: list[WebSocket] = []
        for websocket in recipients:
            try:
                await websocket.send_json(message)
            except RuntimeError:
                stale.append(websocket)

        if stale:
            await self._drop_many(stale)

    async def _drop_many(self, websockets: Iterable[WebSocket]) -> None:
        async with self._lock:
            for websocket in websockets:
                self._connections.discard(websocket)
