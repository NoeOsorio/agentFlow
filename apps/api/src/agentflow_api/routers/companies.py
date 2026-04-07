import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Company
from ..schemas import CompanyCreate, CompanyRead

router = APIRouter(prefix="/companies", tags=["companies"])

DB = Annotated[AsyncSession, Depends(get_db)]


@router.get("/", response_model=list[CompanyRead])
async def list_companies(db: DB):
    result = await db.execute(select(Company).order_by(Company.created_at.desc()))
    return result.scalars().all()


@router.post("/", response_model=CompanyRead, status_code=201)
async def create_company(payload: CompanyCreate, db: DB):
    company = Company(**payload.model_dump())
    db.add(company)
    await db.commit()
    await db.refresh(company)
    return company


@router.get("/{name}", response_model=CompanyRead)
async def get_company(name: str, db: DB):
    result = await db.execute(select(Company).where(Company.name == name))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


@router.delete("/{name}", status_code=204)
async def delete_company(name: str, db: DB):
    result = await db.execute(select(Company).where(Company.name == name))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    await db.delete(company)
    await db.commit()
