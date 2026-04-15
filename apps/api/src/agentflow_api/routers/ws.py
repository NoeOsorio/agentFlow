import json
import uuid
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Agent

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/runs/{run_id}")
async def run_websocket(websocket: WebSocket, run_id: str, db: AsyncSession = Depends(get_db)):
    await websocket.accept()
    try:
        import redis.asyncio as aioredis
        from ..config import settings
        r = aioredis.from_url(settings.redis_url)
        pubsub = r.pubsub()
        await pubsub.subscribe(f"agentflow:stream:{run_id}")
        try:
            async for message in pubsub.listen():
                if message["type"] != "message":
                    continue
                data = message["data"]
                if isinstance(data, bytes):
                    data = data.decode()
                await websocket.send_text(data)
                try:
                    event = json.loads(data)
                    if event.get("event") in ("pipeline_complete", "pipeline_error"):
                        break
                except Exception:
                    pass
        finally:
            await pubsub.unsubscribe(f"agentflow:stream:{run_id}")
            await r.aclose()
    except ImportError:
        await websocket.send_text(json.dumps({"error": "Redis not available"}))
    except WebSocketDisconnect:
        pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass


@router.websocket("/ws/companies/{company_id}/agents")
async def company_agents_websocket(
    websocket: WebSocket,
    company_id: str,
    db: AsyncSession = Depends(get_db),
):
    await websocket.accept()
    try:
        result = await db.execute(
            select(Agent).where(Agent.company_id == uuid.UUID(company_id))
        )
        agents = result.scalars().all()
        agent_names = {a.name for a in agents}

        import redis.asyncio as aioredis
        from ..config import settings
        r = aioredis.from_url(settings.redis_url)
        pubsub = r.pubsub()
        channels = [f"agentflow:heartbeat:{name}" for name in agent_names]
        if channels:
            await pubsub.subscribe(*channels)
        try:
            async for message in pubsub.listen():
                if message["type"] != "message":
                    continue
                data = message["data"]
                if isinstance(data, bytes):
                    data = data.decode()
                await websocket.send_text(data)
        finally:
            if channels:
                await pubsub.unsubscribe(*channels)
            await r.aclose()
    except ImportError:
        await websocket.send_text(json.dumps({"error": "Redis not available"}))
    except WebSocketDisconnect:
        pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
