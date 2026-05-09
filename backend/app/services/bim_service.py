"""BIM / IFC model management."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models import BimModel

IFC_EXTENSIONS = {".ifc", ".ifczip", ".ifcxml"}


def _storage_dir() -> Path:
    path = Path(settings.UPLOAD_DIR) / "bim"
    path.mkdir(parents=True, exist_ok=True)
    return path


async def upload_bim_model(
    db: AsyncSession,
    user_id: uuid.UUID,
    file: UploadFile,
    versao: str = "v1",
    descricao: str | None = None,
) -> BimModel:
    content = await file.read()
    size = len(content)

    if size > settings.BIM_MAX_BYTES:
        raise HTTPException(413, "Modelo BIM demasiado grande. Máximo: 200 MB.")

    filename = file.filename or "model.ifc"
    ext = Path(filename).suffix.lower()
    if ext not in IFC_EXTENSIONS:
        raise HTTPException(415, "Apenas ficheiros .ifc, .ifczip e .ifcxml são aceites.")

    storage_dir = _storage_dir()
    unique_name = f"{uuid.uuid4()}{ext}"
    file_path = storage_dir / unique_name
    file_path.write_bytes(content)

    model = BimModel(
        nome=filename,
        versao=versao,
        descricao=descricao,
        storage_path=str(file_path),
        tamanho_bytes=size,
        mime_type=file.content_type or "application/octet-stream",
        estado="ready",
        created_by=user_id,
    )
    db.add(model)
    await db.commit()
    await db.refresh(model)
    return model


async def list_bim_models(db: AsyncSession) -> list[BimModel]:
    result = await db.execute(
        select(BimModel)
        .where(BimModel.deleted_at.is_(None))
        .order_by(BimModel.created_at.desc())
    )
    return list(result.scalars().all())


async def get_bim_model(db: AsyncSession, model_id: uuid.UUID) -> BimModel:
    result = await db.execute(
        select(BimModel).where(
            BimModel.id == model_id,
            BimModel.deleted_at.is_(None),
        )
    )
    model = result.scalar_one_or_none()
    if not model:
        raise HTTPException(404, f"Modelo BIM {model_id} não encontrado.")
    return model


async def get_bim_model_file(db: AsyncSession, model_id: uuid.UUID) -> tuple[Path, str]:
    model = await get_bim_model(db, model_id)
    file_path = Path(model.storage_path)

    upload_dir = Path(settings.UPLOAD_DIR).resolve()
    if not file_path.resolve().is_relative_to(upload_dir):
        raise HTTPException(403, "Acesso negado.")
    if not file_path.exists():
        raise HTTPException(404, "Ficheiro não encontrado no servidor.")

    return file_path, model.nome


async def delete_bim_model(db: AsyncSession, model_id: uuid.UUID) -> None:
    model = await get_bim_model(db, model_id)
    model.deleted_at = datetime.now(timezone.utc)
    await db.commit()
