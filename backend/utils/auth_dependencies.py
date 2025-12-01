"""
FastAPI authentication dependencies
Provides dependency injection for authentication and authorization
"""
from typing import Optional
from fastapi import Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials, OAuth2PasswordBearer
from models.auth import User, UserRole, TokenData
from services.auth_service import AuthService
from utils.constants import ErrorMessages

# Security schemes
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")
bearer_scheme = HTTPBearer(auto_error=False)

# Global auth service instance (will be initialized in main.py)
auth_service: Optional[AuthService] = None


def set_auth_service(service: AuthService):
    """Set global auth service instance"""
    global auth_service
    auth_service = service


async def get_current_user_from_token(token: str = Depends(oauth2_scheme)) -> User:
    """
    Get current user from JWT token
    Raises HTTP 401 if token is invalid or user not found
    """
    if not auth_service:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service not available"
        )

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=ErrorMessages.INVALID_TOKEN,
        headers={"WWW-Authenticate": "Bearer"},
    )

    token_data = auth_service.decode_access_token(token)
    if token_data is None or token_data.username is None:
        raise credentials_exception

    user = await auth_service.get_user_without_password(token_data.username)
    if user is None:
        raise credentials_exception

    if user.disabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled"
        )

    return user


async def get_current_user_from_api_key(x_api_key: Optional[str] = Header(None)) -> Optional[User]:
    """
    Get current user from API key header
    Returns None if no API key provided or invalid
    """
    if not x_api_key:
        return None

    if not auth_service:
        return None

    user = await auth_service.verify_api_key(x_api_key)
    if user and user.disabled:
        return None

    return user


async def get_current_user(
    token_user: Optional[User] = Depends(get_current_user_from_token),
    api_key_user: Optional[User] = Depends(get_current_user_from_api_key)
) -> User:
    """
    Get current user from either JWT token or API key
    Prioritizes JWT token over API key
    """
    # Try token first
    if token_user:
        return token_user

    # Try API key
    if api_key_user:
        return api_key_user

    # No valid authentication
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=ErrorMessages.UNAUTHORIZED,
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Get current active user (not disabled)
    """
    if current_user.disabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled"
        )
    return current_user


def require_role(allowed_roles: list[UserRole]):
    """
    Dependency factory for role-based access control
    Returns a dependency that checks if user has required role

    Usage:
        @app.get("/admin", dependencies=[Depends(require_role([UserRole.ADMIN]))])
    """
    async def check_role(current_user: User = Depends(get_current_active_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=ErrorMessages.FORBIDDEN
            )
        return current_user

    return check_role


# Convenience dependencies for common role requirements
async def require_admin(current_user: User = Depends(get_current_active_user)) -> User:
    """Require admin role"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=ErrorMessages.FORBIDDEN
        )
    return current_user


async def require_operator_or_admin(current_user: User = Depends(get_current_active_user)) -> User:
    """Require operator or admin role"""
    if current_user.role not in [UserRole.OPERATOR, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=ErrorMessages.FORBIDDEN
        )
    return current_user


# Optional authentication (for endpoints that work with or without auth)
async def get_current_user_optional(
    authorization: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    x_api_key: Optional[str] = Header(None)
) -> Optional[User]:
    """
    Get current user if authenticated, None otherwise
    Useful for endpoints that provide additional features for authenticated users
    """
    if not auth_service:
        return None

    # Try JWT token
    if authorization:
        try:
            token_data = auth_service.decode_access_token(authorization.credentials)
            if token_data and token_data.username:
                user = await auth_service.get_user_without_password(token_data.username)
                if user and not user.disabled:
                    return user
        except:
            pass

    # Try API key
    if x_api_key:
        try:
            user = await auth_service.verify_api_key(x_api_key)
            if user and not user.disabled:
                return user
        except:
            pass

    return None
