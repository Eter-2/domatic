from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class BimModelResponse(BaseModel):
    id: uuid.UUID
    nome: str
    versao: str
    descricao: Optional[str] = None
    tamanho_bytes: int
    tamanho_mb: float
    mime_type: str
    estado: str
    created_by: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_with_size(cls, obj) -> "BimModelResponse":
        data = cls.model_validate(obj)
        data.tamanho_mb = round(obj.tamanho_bytes / 1_048_576, 2)
        return data


class BimModelListResponse(BaseModel):
    items: list[BimModelResponse]
    total: int
