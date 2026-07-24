"""Authentication endpoints."""
from datetime import timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

import state
from models.auth import (
    APIKey, APIKeyCreate, PasswordChange, Token, User, UserCreate, UserUpdate,
)
from utils.auth_dependencies import (
    get_current_active_user, get_current_user, require_admin,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """Login with username and password to get JWT token."""
    if not state.auth_service:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Authentication service not available")
    user = await state.auth_service.authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = state.auth_service.create_access_token(
        data={"sub": user.username, "role": user.role.value},
        expires_delta=timedelta(minutes=30),
    )
    return token


@router.post("/register", response_model=User, status_code=status.HTTP_201_CREATED)
async def register(user_create: UserCreate, current_user: User = Depends(require_admin)):
    """Register a new user (admin only)."""
    if not state.auth_service:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Authentication service not available")
    if await state.auth_service.get_user(user_create.username):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already registered")
    return await state.auth_service.create_user(user_create)


@router.get("/me", response_model=User)
async def get_current_user_info(current_user: User = Depends(get_current_active_user)):
    """Get current authenticated user information."""
    return current_user


@router.get("/users", response_model=List[User])
async def list_users(current_user: User = Depends(require_admin)):
    """List all users (admin only)."""
    if not state.auth_service:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Authentication service not available")
    return await state.auth_service.list_users()


@router.patch("/users/{username}", response_model=User)
async def update_user(username: str, user_update: UserUpdate, current_user: User = Depends(require_admin)):
    """Update user information (admin only)."""
    if not state.auth_service:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Authentication service not available")
    updated_user = await state.auth_service.update_user(username, user_update)
    if not updated_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return updated_user


@router.delete("/users/{username}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(username: str, current_user: User = Depends(require_admin)):
    """Delete a user (admin only). Cannot delete yourself."""
    if not state.auth_service:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Authentication service not available")
    if username == current_user.username:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete your own account")
    if not await state.auth_service.delete_user(username):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return None


@router.post("/change-password")
async def change_password(password_change: PasswordChange, current_user: User = Depends(get_current_active_user)):
    """Change current user's password."""
    if not state.auth_service:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Authentication service not available")
    user_in_db = await state.auth_service.get_user(current_user.username)
    if not user_in_db or not state.auth_service.verify_password(password_change.old_password, user_in_db.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Incorrect password")
    await state.auth_service.update_user(current_user.username, UserUpdate(password=password_change.new_password))
    return {"message": "Password updated successfully"}


@router.post("/api-keys", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_api_key(api_key_create: APIKeyCreate, current_user: User = Depends(get_current_active_user)):
    """Create a new API key for current user. Returns the key once — store it securely."""
    if not state.auth_service:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Authentication service not available")
    api_key_obj, raw_key = await state.auth_service.create_api_key(current_user.id, api_key_create)
    return {
        "id": api_key_obj.id,
        "name": api_key_obj.name,
        "api_key": raw_key,
        "created_at": api_key_obj.created_at,
        "expires_at": api_key_obj.expires_at,
        "message": "Store this API key securely - it will not be shown again",
    }


@router.get("/api-keys", response_model=List[APIKey])
async def list_api_keys(current_user: User = Depends(get_current_active_user)):
    """List current user's API keys."""
    if not state.auth_service:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Authentication service not available")
    return await state.auth_service.list_user_api_keys(current_user.id)


@router.delete("/api-keys/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_api_key(key_id: str, current_user: User = Depends(get_current_active_user)):
    """Revoke (delete) an API key."""
    if not state.auth_service:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Authentication service not available")
    await state.auth_service.revoke_api_key(key_id, current_user.id)
    return None
