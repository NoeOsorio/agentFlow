import hashlib
import secrets
from typing import Annotated

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .database import get_db
from .models import APIKey

SCOPES = ["companies:read", "companies:write", "pipelines:read", "pipelines:write", "runs:write", "admin"]


def generate_api_key() -> tuple[str, str]:
    """Returns (plain_key, sha256_hash). plain_key shown only once."""
    plain = secrets.token_urlsafe(32)
    hashed = hashlib.sha256(plain.encode()).hexdigest()
    return plain, hashed


async def verify_api_key(plain_key: str, db: AsyncSession) -> APIKey | None:
    hashed = hashlib.sha256(plain_key.encode()).hexdigest()
    result = await db.execute(select(APIKey).where(APIKey.key_hash == hashed, APIKey.revoked == False))
    return result.scalar_one_or_none()


async def get_current_key(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> APIKey:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    plain_key = auth.removeprefix("Bearer ").strip()
    api_key = await verify_api_key(plain_key, db)
    if not api_key:
        raise HTTPException(status_code=401, detail="Invalid or revoked API key")
    return api_key
