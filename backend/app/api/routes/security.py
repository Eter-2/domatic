from __future__ import annotations

import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.schemas.auth import UserResponse
from app.schemas.security import SecurityEventResponse, SecurityStatsResponse
from app.services import security_service
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/security", tags=["Security"])


@router.get(
    "/events",
    response_model=List[SecurityEventResponse],
    status_code=status.HTTP_200_OK,
)
async def list_events(
    resolved: Optional[bool] = Query(default=None, description="Filter by resolved status."),
    severity: Optional[str] = Query(default=None, description="Filter by severity level."),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: UserResponse = Depends(get_current_user),
):
    return await security_service.get_events(
        db, resolved=resolved, severity=severity, limit=limit, offset=offset
    )


@router.post(
    "/events/{event_id}/resolve",
    response_model=SecurityEventResponse,
    status_code=status.HTTP_200_OK,
)
async def resolve_event(
    event_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: UserResponse = Depends(get_current_user),
):
    return await security_service.resolve_event(db, event_id)


@router.get(
    "/stats",
    response_model=SecurityStatsResponse,
    status_code=status.HTTP_200_OK,
)
async def get_stats(
    db: AsyncSession = Depends(get_db),
    _: UserResponse = Depends(get_current_user),
):
    return await security_service.get_stats(db)
