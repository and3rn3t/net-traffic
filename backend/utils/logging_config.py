"""
Structured Logging Configuration
Provides JSON-formatted logging for better analysis and monitoring
"""
import logging
import sys
from pythonjsonlogger import jsonlogger
from typing import Optional
from datetime import datetime


class CustomJsonFormatter(jsonlogger.JsonFormatter):
    """
    Custom JSON formatter with additional fields
    """

    def add_fields(self, log_record, record, message_dict):
        """Add custom fields to log records"""
        super(CustomJsonFormatter, self).add_fields(log_record, record, message_dict)

        # Add timestamp in ISO format
        if not log_record.get('timestamp'):
            log_record['timestamp'] = datetime.utcnow().isoformat() + 'Z'

        # Add log level
        if log_record.get('level'):
            log_record['level'] = log_record['level'].upper()
        else:
            log_record['level'] = record.levelname

        # Add application name
        log_record['application'] = 'netinsight'

        # Add module and function context
        if not log_record.get('module'):
            log_record['module'] = record.module
        if not log_record.get('function'):
            log_record['function'] = record.funcName
        if not log_record.get('line'):
            log_record['line'] = record.lineno

        # Add process and thread info for debugging
        if not log_record.get('process'):
            log_record['process'] = record.process
        if not log_record.get('thread'):
            log_record['thread'] = record.thread


def setup_logging(
    level: str = "INFO",
    use_json: bool = True,
    log_file: Optional[str] = None
):
    """
    Setup application-wide logging configuration

    Args:
        level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        use_json: Use JSON formatting (True) or plain text (False)
        log_file: Optional file path for file logging
    """
    # Convert string level to logging constant
    log_level = getattr(logging, level.upper(), logging.INFO)

    # Create root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)

    # Remove existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)

    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(log_level)

    if use_json:
        # JSON formatter for structured logging
        formatter = CustomJsonFormatter(
            '%(timestamp)s %(level)s %(name)s %(message)s',
            rename_fields={
                'levelname': 'level',
                'name': 'logger',
            }
        )
    else:
        # Plain text formatter for development
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )

    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)

    # File handler (optional)
    if log_file:
        try:
            file_handler = logging.FileHandler(log_file)
            file_handler.setLevel(log_level)
            file_handler.setFormatter(formatter)
            root_logger.addHandler(file_handler)
            logging.info(f"File logging enabled: {log_file}")
        except Exception as e:
            logging.error(f"Failed to setup file logging: {e}")

    logging.info(
        f"Logging configured",
        extra={
            'level': level,
            'json_format': use_json,
            'file_logging': log_file is not None
        }
    )


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger instance with structured logging support

    Args:
        name: Logger name (usually __name__)

    Returns:
        Configured logger instance
    """
    return logging.getLogger(name)


class StructuredLogger:
    """
    Wrapper for structured logging with extra context
    """

    def __init__(self, name: str):
        """Initialize structured logger"""
        self.logger = logging.getLogger(name)
        self.default_extra = {}

    def set_context(self, **kwargs):
        """
        Set default context fields for all log messages

        Example:
            logger.set_context(user_id="123", request_id="abc")
        """
        self.default_extra.update(kwargs)

    def clear_context(self):
        """Clear default context fields"""
        self.default_extra.clear()

    def _log(self, level: int, message: str, **kwargs):
        """Internal log method with context merging"""
        extra = {**self.default_extra, **kwargs}
        self.logger.log(level, message, extra=extra)

    def debug(self, message: str, **kwargs):
        """Log debug message with extra context"""
        self._log(logging.DEBUG, message, **kwargs)

    def info(self, message: str, **kwargs):
        """Log info message with extra context"""
        self._log(logging.INFO, message, **kwargs)

    def warning(self, message: str, **kwargs):
        """Log warning message with extra context"""
        self._log(logging.WARNING, message, **kwargs)

    def error(self, message: str, **kwargs):
        """Log error message with extra context"""
        self._log(logging.ERROR, message, **kwargs)

    def critical(self, message: str, **kwargs):
        """Log critical message with extra context"""
        self._log(logging.CRITICAL, message, **kwargs)

    def exception(self, message: str, **kwargs):
        """Log exception with traceback and extra context"""
        extra = {**self.default_extra, **kwargs}
        self.logger.exception(message, extra=extra)


# Convenience function for quick structured logging
def log_event(
    level: str,
    message: str,
    logger_name: str = "netinsight",
    **context
):
    """
    Log an event with structured context

    Args:
        level: Log level (debug, info, warning, error, critical)
        message: Log message
        logger_name: Logger name
        **context: Additional context fields

    Example:
        log_event('info', 'User logged in', user_id='123', ip='1.2.3.4')
    """
    logger = logging.getLogger(logger_name)
    log_level = getattr(logging, level.upper(), logging.INFO)
    logger.log(log_level, message, extra=context)


# Request logging helper
def log_request(
    method: str,
    path: str,
    status_code: int,
    duration_ms: float,
    **extra
):
    """
    Log HTTP request with standard fields

    Args:
        method: HTTP method (GET, POST, etc.)
        path: Request path
        status_code: HTTP status code
        duration_ms: Request duration in milliseconds
        **extra: Additional context
    """
    log_event(
        'info',
        'HTTP request',
        http_method=method,
        http_path=path,
        http_status=status_code,
        duration_ms=duration_ms,
        **extra
    )


# Error logging helper
def log_error(
    error: Exception,
    context: str,
    **extra
):
    """
    Log error with exception details

    Args:
        error: Exception object
        context: Context where error occurred
        **extra: Additional context
    """
    log_event(
        'error',
        f"Error in {context}: {str(error)}",
        error_type=type(error).__name__,
        error_message=str(error),
        context=context,
        **extra
    )


# Security event logging
def log_security_event(
    event_type: str,
    severity: str,
    description: str,
    **extra
):
    """
    Log security-related event

    Args:
        event_type: Type of security event (auth_failure, unauthorized_access, etc.)
        severity: Severity level (low, medium, high, critical)
        description: Event description
        **extra: Additional context
    """
    log_event(
        'warning' if severity in ['low', 'medium'] else 'error',
        description,
        event_type='security',
        security_event=event_type,
        severity=severity,
        **extra
    )


# Performance logging helper
def log_performance(
    operation: str,
    duration_ms: float,
    success: bool = True,
    **extra
):
    """
    Log performance metrics

    Args:
        operation: Operation name
        duration_ms: Duration in milliseconds
        success: Whether operation succeeded
        **extra: Additional metrics
    """
    log_event(
        'info',
        f"Performance: {operation}",
        event_type='performance',
        operation=operation,
        duration_ms=duration_ms,
        success=success,
        **extra
    )
