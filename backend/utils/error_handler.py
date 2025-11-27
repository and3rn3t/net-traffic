"""
Error handling utilities for API endpoints
"""
import logging
from typing import Optional
from fastapi import HTTPException
import aiosqlite

logger = logging.getLogger(__name__)


class ErrorHandler:
    """Centralized error handling for API endpoints"""

    @staticmethod
    async def handle_database_operation(operation, error_message: str = "Database operation failed"):
        """Handle database operations with proper error handling"""
        try:
            return await operation()
        except aiosqlite.OperationalError as e:
            error_str = str(e).lower()
            if 'locked' in error_str:
                logger.error(f"Database locked: {e}")
                raise HTTPException(
                    status_code=503,
                    detail="Database is currently locked. Please try again later."
                )
            elif 'no such table' in error_str:
                logger.error(f"Database table missing: {e}")
                raise HTTPException(
                    status_code=500,
                    detail="Database schema error. Please contact administrator."
                )
            else:
                logger.error(f"Database operational error: {e}")
                raise HTTPException(
                    status_code=500,
                    detail=f"{error_message}: {str(e)}"
                )
        except aiosqlite.DatabaseError as e:
            logger.error(f"Database error: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"{error_message}: Database error occurred"
            )
        except Exception as e:
            logger.error(f"Unexpected error in database operation: {e}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"{error_message}: Unexpected error"
            )

    @staticmethod
    async def handle_service_operation(operation, service_name: str = "Service"):
        """Handle service operations with proper error handling"""
        try:
            return await operation()
        except AttributeError as e:
            logger.error(f"{service_name} method error: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"{service_name} method not available"
            )
        except Exception as e:
            logger.error(f"{service_name} error: {e}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"{service_name} operation failed: {str(e)}"
            )

    @staticmethod
    def handle_validation_error(error: Exception) -> HTTPException:
        """Handle validation errors"""
        logger.warning(f"Validation error: {error}")
        if isinstance(error, HTTPException):
            return error
        return HTTPException(
            status_code=400,
            detail=f"Validation error: {str(error)}"
        )

    @staticmethod
    def handle_not_found_error(
        resource_type: str,
        resource_id: Optional[str] = None
    ) -> HTTPException:
        """Handle resource not found errors"""
        if resource_id:
            detail = f"{resource_type} with ID '{resource_id}' not found"
        else:
            detail = f"{resource_type} not found"
        return HTTPException(status_code=404, detail=detail)

    @staticmethod
    def handle_service_unavailable(service_name: str) -> HTTPException:
        """Handle service unavailable errors"""
        return HTTPException(
            status_code=503,
            detail=f"{service_name} is not available"
        )


# Convenience function for wrapping endpoint logic
async def handle_endpoint_error(operation, error_message: str = "Operation failed"):
    """Wrapper for endpoint operations with error handling"""
    try:
        return await operation()
    except HTTPException:
        # Re-raise HTTP exceptions (they're already properly formatted)
        raise
    except ValueError as e:
        # Validation errors
        logger.warning(f"Validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except aiosqlite.Error as e:
        # Database errors
        logger.error(f"Database error: {e}")
        raise HTTPException(
            status_code=500,
            detail="Database error occurred. Please try again later."
        )
    except Exception as e:
        # Unexpected errors
        logger.error(f"Unexpected error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"{error_message}: An unexpected error occurred"
        )

