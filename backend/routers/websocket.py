"""WebSocket endpoint for real-time updates."""
import logging
from typing import Optional

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

import state

logger = logging.getLogger(__name__)
router = APIRouter(tags=["websocket"])


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    topics: Optional[str] = Query(
        None, description="Comma-separated event types to receive (e.g. 'threat_update,new_device'). Omit for all events."
    ),
):
    """WebSocket endpoint for real-time updates.

    Clients may opt into a subset of broadcast event types via the `topics`
    query parameter to reduce load on both the server and the client, e.g.
    `/ws?topics=threat_update,device_update`.
    """
    await websocket.accept()
    state.active_connections.append(websocket)
    topic_set = {t.strip() for t in topics.split(",") if t.strip()} if topics else None
    state.connection_topics[websocket] = topic_set
    logger.info(f"WebSocket client connected. Total connections: {len(state.active_connections)}")

    try:
        if state.storage:
            devices = await state.storage.get_devices()
            flows = await state.storage.get_flows(limit=50)
            threats = await state.storage.get_threats(active_only=True)
            await websocket.send_json({
                "type": "initial_state",
                "devices": [device.dict() for device in devices],
                "flows": [flow.dict() for flow in flows],
                "threats": [threat.dict() for threat in threats],
            })

        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.exception(f"WebSocket error: {e}")
    finally:
        if websocket in state.active_connections:
            state.active_connections.remove(websocket)
        state.connection_topics.pop(websocket, None)
        logger.info(f"WebSocket client removed. Total connections: {len(state.active_connections)}")
