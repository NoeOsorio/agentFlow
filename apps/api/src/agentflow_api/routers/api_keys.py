import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import generate_api_key, get_current_key
from ..database import get_db
from ..models import APIKey

router = APIRouter(prefix="/keys", tags=["api-keys"])

DB = Annotated[AsyncSession, Depends(get_db)]


class APIKeyCreate(BaseModel):
    name: str
    scopes: list[str] = ["pipelines:read", "pipelines:write", "runs:write"]


class APIKeyRead(BaseModel):
    id: uuid.UUID
    name: str
    scopes: list[str]
    created_at: datetime
    last_used_at: datetime | None
    revoked: bool

    model_config = {"from_attributes": True}


class APIKeyCreated(APIKeyRead):
    plain_key: str  # only returned on creation


@router.post("/", response_model=APIKeyCreated, status_code=201)
async def create_api_key(payload: APIKeyCreate, db: DB):
    plain_key, key_hash = generate_api_key()
    api_key = APIKey(
        name=payload.name,
        key_hash=key_hash,
        scopes=payload.scopes,
    )
    db.add(api_key)
    await db.commit()
    await db.refresh(api_key)
    return APIKeyCreated(
        id=api_key.id,
        name=api_key.name,
        scopes=api_key.scopes,
        created_at=api_key.created_at,
        last_used_at=api_key.last_used_at,
        revoked=api_key.revoked,
        plain_key=plain_key,
    )


@router.get("/", response_model=list[APIKeyRead])
async def list_api_keys(db: DB):
    result = await db.execute(select(APIKey).order_by(APIKey.created_at.desc()))
    return result.scalars().all()


@router.delete("/{key_id}", status_code=204)
async def revoke_api_key(key_id: uuid.UUID, db: DB):
    api_key = await db.get(APIKey, key_id)
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")
    api_key.revoked = True
    await db.commit()
