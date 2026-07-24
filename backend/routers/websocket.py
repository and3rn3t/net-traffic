"""WebSocket endpoint for real-time updates."""
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

import state

logger = logging.getLogger(__name__)
router = APIRouter(tags=["websocket"])


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time updates."""
    await websocket.accept()
    state.active_connections.append(websocket)
    logger.info(f"WebSocket client connected. Total connections: {len(state.active_connections)}")

    try:
        if state.storage:
            await websocket.send_json({
                "type": "initial_state",
                "devices": await state.storage.get_devices(),
                "flows": await state.storage.get_flows(limit=50),
                "threats": await state.storage.get_threats(active_only=True),
            })

        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        if websocket in state.active_connections:
            state.active_connections.remove(websocket)
        logger.info(f"WebSocket client removed. Total connections: {len(state.active_connections)}")
