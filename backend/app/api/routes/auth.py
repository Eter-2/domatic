import logging
import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.base import get_db
from app.db.models import User
from app.main import limiter
from app.schemas.auth import (
    LoginRequest,
    RefreshRequest,
    SetupRequest,
    SetupResponse,
    TokenResponse,
    UserResponse,
)
from app.services.auth_service import (
    authenticate_user,
    create_access_token,
    create_refresh_token,
    get_current_user,
    hash_password,
    verify_token,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse, status_code=status.HTTP_200_OK)
@limiter.limit("5/minute")
async def login(request: Request, body: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate with username + password, receive JWT tokens.

    Rate-limited to 5 attempts per minute per IP to prevent brute-force attacks.
    """
    credential = body.email or body.username or ""
    user = await authenticate_user(db, credential, body.password)
    if user is None:
        # A01/A07: Return identical error regardless of whether username or
        # password was wrong — prevents user enumeration.
        logger.warning(
            "Failed login attempt for '%s'.", credential
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    refresh_token = create_refresh_token(data={"sub": str(user.id)})
    logger.info("User '%s' logged in successfully.", user.username)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/refresh", response_model=TokenResponse, status_code=status.HTTP_200_OK)
async def refresh_token(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    """Exchange a refresh token for a new access token pair."""
    payload = verify_token(body.refresh_token, expected_type="refresh")
    user_id = payload["sub"]

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive."
        )

    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    new_refresh_token = create_refresh_token(data={"sub": str(user.id)})
    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.get("/me", response_model=UserResponse, status_code=status.HTTP_200_OK)
async def get_me(current_user: UserResponse = Depends(get_current_user)):
    """Return the currently authenticated user's profile."""
    return current_user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(current_user: UserResponse = Depends(get_current_user)):
    """
    Stateless logout. Clients should discard their tokens.
    Server-side token blacklisting can be added via Redis if required.
    """
    logger.info("User '%s' logged out.", current_user.username)
    return None


@router.get("/setup/status", status_code=status.HTTP_200_OK)
async def setup_status(db: AsyncSession = Depends(get_db)):
    """Check whether first-time setup is still required."""
    count_result = await db.execute(select(func.count(User.id)))
    count: int = count_result.scalar_one()
    return {"setup_required": count == 0}


@router.post("/setup", response_model=SetupResponse, status_code=status.HTTP_201_CREATED)
async def setup(body: SetupRequest, db: AsyncSession = Depends(get_db)):
    """
    First-time setup: create the initial admin user and return auth tokens.
    Only allowed when the users table is empty.
    """
    count_result = await db.execute(select(func.count(User.id)))
    count: int = count_result.scalar_one()
    if count > 0:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Setup already completed. Use /auth/login.",
        )

    # Check for duplicate username or email
    dup_result = await db.execute(
        select(User).where(
            (User.username == body.username) | (User.email == body.email)
        )
    )
    if dup_result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username or email already in use.",
        )

    user = User(
        username=body.username,
        email=body.email,
        hashed_password=hash_password(body.password),
    )
    db.add(user)
    await db.flush()
    logger.info("Initial admin user '%s' created.", user.username)

    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    new_refresh_token = create_refresh_token(data={"sub": str(user.id)})
    return SetupResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserResponse.model_validate(user),
    )
