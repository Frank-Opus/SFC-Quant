from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter(tags=["realtime"])


@router.websocket("/ws")
async def websocket_stream(websocket: WebSocket) -> None:
    service = websocket.app.state.market_service
    hub = websocket.app.state.websocket_hub

    await hub.connect(websocket)
    try:
        connection_event = await service.connection_event()
        await hub.send_personal_message(
            websocket,
            connection_event.model_dump(mode="json"),
        )
        snapshot = service.snapshot_response().model_dump(mode="json")
        await hub.send_personal_message(
            websocket,
            {
                "event_id": connection_event.event_id,
                "event_type": "market.snapshot",
                "generated_at": connection_event.generated_at.isoformat(),
                "source": "backend",
                "payload": snapshot,
            },
        )
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await hub.disconnect(websocket)
