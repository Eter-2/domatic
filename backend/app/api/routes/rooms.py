from __future__ import annotations

import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.base import get_db
from app.db.models import Device, Room
from app.schemas.auth import UserResponse
from app.schemas.rooms import RoomCreate, RoomResponse, RoomUpdate
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/rooms", tags=["Rooms"])


async def _get_room_or_404(db: AsyncSession, room_id: uuid.UUID) -> Room:
    result = await db.execute(select(Room).where(Room.id == room_id))
    room = result.scalar_one_or_none()
    if room is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found.")
    return room


async def _build_room_response(db: AsyncSession, room: Room) -> RoomResponse:
    count_result = await db.execute(
        select(func.count(Device.id)).where(Device.room_id == room.id)
    )
    device_count: int = count_result.scalar_one()
    return RoomResponse(
        id=room.id,
        name=room.name,
        icon=room.icon,
        floor=room.floor,
        device_count=device_count,
        created_at=room.created_at,
    )


@router.get("", response_model=List[RoomResponse], status_code=status.HTTP_200_OK)
async def list_rooms(
    db: AsyncSession = Depends(get_db),
    _: UserResponse = Depends(get_current_user),
):
    result = await db.execute(select(Room).order_by(Room.floor, Room.name))
    rooms = result.scalars().all()
    return [await _build_room_response(db, r) for r in rooms]


@router.post("", response_model=RoomResponse, status_code=status.HTTP_201_CREATED)
async def create_room(
    body: RoomCreate,
    db: AsyncSession = Depends(get_db),
    _: UserResponse = Depends(get_current_user),
):
    room = Room(name=body.name, icon=body.icon, floor=body.floor)
    db.add(room)
    await db.flush()
    return await _build_room_response(db, room)


@router.get("/{room_id}", response_model=RoomResponse, status_code=status.HTTP_200_OK)
async def get_room(
    room_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: UserResponse = Depends(get_current_user),
):
    room = await _get_room_or_404(db, room_id)
    return await _build_room_response(db, room)


@router.put("/{room_id}", response_model=RoomResponse, status_code=status.HTTP_200_OK)
async def update_room(
    room_id: uuid.UUID,
    body: RoomUpdate,
    db: AsyncSession = Depends(get_db),
    _: UserResponse = Depends(get_current_user),
):
    room = await _get_room_or_404(db, room_id)
    if body.name is not None:
        room.name = body.name
    if body.icon is not None:
        room.icon = body.icon
    if body.floor is not None:
        room.floor = body.floor
    await db.flush()
    return await _build_room_response(db, room)


@router.delete("/{room_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_room(
    room_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: UserResponse = Depends(get_current_user),
):
    room = await _get_room_or_404(db, room_id)
    await db.delete(room)
    return None
