import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class CompanyCreate(BaseModel):
    name: str
    namespace: str = "default"
    yaml_spec: str
    description: str | None = None


class CompanyRead(BaseModel):
    id: uuid.UUID
    name: str
    namespace: str
    yaml_spec: str
    description: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PipelineCreate(BaseModel):
    name: str
    namespace: str = "default"
    yaml_spec: str
    company_id: uuid.UUID | None = None


class PipelineRead(BaseModel):
    id: uuid.UUID
    name: str
    namespace: str
    yaml_spec: str
    version: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RunRead(BaseModel):
    id: uuid.UUID
    pipeline_id: uuid.UUID
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TriggerPayload(BaseModel):
    source: str
    data: dict = Field(default_factory=dict)
