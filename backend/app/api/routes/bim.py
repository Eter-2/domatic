"""BIM Hub endpoints — upload, list, download and delete IFC models."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.schemas.auth import UserResponse
from app.schemas.bim import BimModelListResponse, BimModelResponse
from app.services import bim_service
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/bim", tags=["BIM"])


@router.post("", response_model=BimModelResponse, status_code=status.HTTP_201_CREATED)
async def upload_bim_model(
    file: UploadFile = File(...),
    versao: str = Form(default="v1"),
    descricao: str | None = Form(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    model = await bim_service.upload_bim_model(
        db=db,
        user_id=current_user.id,
        file=file,
        versao=versao,
        descricao=descricao,
    )
    return BimModelResponse.from_orm_with_size(model)


@router.get("", response_model=BimModelListResponse)
async def list_bim_models(
    db: AsyncSession = Depends(get_db),
    _: UserResponse = Depends(get_current_user),
):
    items = await bim_service.list_bim_models(db)
    return BimModelListResponse(
        items=[BimModelResponse.from_orm_with_size(m) for m in items],
        total=len(items),
    )


@router.get("/{model_id}", response_model=BimModelResponse)
async def get_bim_model(
    model_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: UserResponse = Depends(get_current_user),
):
    model = await bim_service.get_bim_model(db, model_id)
    return BimModelResponse.from_orm_with_size(model)


@router.get("/{model_id}/download")
async def download_bim_model(
    model_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: UserResponse = Depends(get_current_user),
):
    file_path, filename = await bim_service.get_bim_model_file(db, model_id)
    return FileResponse(
        path=str(file_path),
        filename=filename,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.delete("/{model_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bim_model(
    model_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: UserResponse = Depends(get_current_user),
):
    await bim_service.delete_bim_model(db, model_id)
