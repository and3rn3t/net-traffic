"""
Authentication and authorization models
"""

from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, EmailStr, Field, validator


class UserRole(StrEnum):
    """User role enumeration"""

    ADMIN = "admin"  # Full access - manage users, settings, devices
    OPERATOR = "operator"  # Can manage devices, threats, capture
    VIEWER = "viewer"  # Read-only access


class User(BaseModel):
    """User model"""

    id: str
    username: str
    email: EmailStr | None = None
    full_name: str | None = None
    role: UserRole = UserRole.VIEWER
    disabled: bool = False
    created_at: datetime
    last_login: datetime | None = None


class UserInDB(User):
    """User model with password hash (for database)"""

    hashed_password: str


class UserCreate(BaseModel):
    """User creation model"""

    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    full_name: str | None = Field(None, max_length=100)
    role: UserRole = UserRole.VIEWER

    @validator("username")
    def username_alphanumeric(cls, v):
        if not v.replace("_", "").replace("-", "").isalnum():
            raise ValueError("Username must be alphanumeric (underscores and hyphens allowed)")
        return v.lower()

    @validator("password")
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


class UserUpdate(BaseModel):
    """User update model"""

    email: EmailStr | None = None
    full_name: str | None = Field(None, max_length=100)
    password: str | None = Field(None, min_length=8, max_length=128)
    role: UserRole | None = None
    disabled: bool | None = None


class Token(BaseModel):
    """JWT token response"""

    access_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class TokenData(BaseModel):
    """Token payload data"""

    username: str | None = None
    role: str | None = None
    exp: int | None = None


class APIKey(BaseModel):
    """API key model"""

    id: str
    key: str  # Hashed key
    name: str
    user_id: str
    created_at: datetime
    last_used: datetime | None = None
    expires_at: datetime | None = None
    disabled: bool = False
    permissions: list[str] = []  # Specific API permissions


class APIKeyCreate(BaseModel):
    """API key creation model"""

    name: str = Field(..., min_length=3, max_length=100)
    expires_days: int | None = Field(None, gt=0, le=365)  # Max 1 year
    permissions: list[str] = []


class LoginRequest(BaseModel):
    """Login request"""

    username: str
    password: str


class PasswordChange(BaseModel):
    """Password change request"""

    old_password: str
    new_password: str = Field(..., min_length=8, max_length=128)

    @validator("new_password")
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v
