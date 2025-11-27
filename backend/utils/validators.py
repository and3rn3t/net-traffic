"""
Input validation utilities for API endpoints
"""
import re
from typing import Optional
from fastapi import HTTPException, Query, Path
from datetime import datetime


# IP address validation regex
IP_PATTERN = re.compile(
    r'^(\d{1,3}\.){3}\d{1,3}$'
)


def validate_ip(ip: str) -> bool:
    """Validate IP address format"""
    if not ip:
        return False
    if not IP_PATTERN.match(ip):
        return False
    parts = ip.split('.')
    return all(0 <= int(part) <= 255 for part in parts)


def validate_limit(limit: int, max_limit: int = 1000) -> int:
    """Validate and clamp limit parameter"""
    if limit < 1:
        raise HTTPException(
            status_code=400,
            detail=f"limit must be >= 1, got {limit}"
        )
    if limit > max_limit:
        raise HTTPException(
            status_code=400,
            detail=f"limit must be <= {max_limit}, got {limit}"
        )
    return limit


def validate_offset(offset: int) -> int:
    """Validate offset parameter"""
    if offset < 0:
        raise HTTPException(
            status_code=400,
            detail=f"offset must be >= 0, got {offset}"
        )
    return offset


def validate_hours(hours: int, max_hours: int = 720) -> int:
    """Validate hours parameter"""
    if hours < 1:
        raise HTTPException(
            status_code=400,
            detail=f"hours must be >= 1, got {hours}"
        )
    if hours > max_hours:
        raise HTTPException(
            status_code=400,
            detail=f"hours must be <= {max_hours} (30 days), got {hours}"
        )
    return hours


def validate_timestamp(timestamp: int, param_name: str = "timestamp") -> int:
    """Validate Unix timestamp in milliseconds"""
    if timestamp < 0:
        raise HTTPException(
            status_code=400,
            detail=f"{param_name} must be >= 0, got {timestamp}"
        )
    # Check if timestamp is reasonable (not too far in future)
    # 1 year in future
    max_timestamp = int(
        datetime.now().timestamp() * 1000
    ) + (365 * 24 * 60 * 60 * 1000)
    if timestamp > max_timestamp:
        raise HTTPException(
            status_code=400,
            detail=f"{param_name} is too far in the future"
        )
    return timestamp


def validate_time_range(start_time: Optional[int], end_time: Optional[int]):
    """Validate time range parameters"""
    if start_time is not None:
        start_time = validate_timestamp(start_time, "start_time")
    if end_time is not None:
        end_time = validate_timestamp(end_time, "end_time")

    if start_time is not None and end_time is not None:
        if start_time > end_time:
            raise HTTPException(
                status_code=400,
                detail="start_time must be <= end_time"
            )

    return start_time, end_time


def validate_string_param(value: str, param_name: str,
                            min_length: int = 1,
                            max_length: int = 200) -> str:
    """Validate string parameter"""
    if not value:
        raise HTTPException(
            status_code=400,
            detail=f"{param_name} cannot be empty"
        )
    if len(value) < min_length:
        raise HTTPException(
            status_code=400,
            detail=f"{param_name} must be at least {min_length} characters"
        )
    if len(value) > max_length:
        raise HTTPException(
            status_code=400,
            detail=f"{param_name} must be at most {max_length} characters"
        )
    return value.strip()


def validate_status(status: str) -> str:
    """Validate flow status"""
    valid_statuses = ['active', 'closed']
    if status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"status must be one of {valid_statuses}, got {status}"
        )
    return status


def validate_protocol(protocol: str) -> str:
    """Validate protocol"""
    valid_protocols = ['TCP', 'UDP', 'ICMP', 'ARP', 'OTHER']
    if protocol.upper() not in valid_protocols:
        raise HTTPException(
            status_code=400,
            detail=f"protocol must be one of {valid_protocols}, got {protocol}"
        )
    return protocol.upper()


def validate_threat_level(threat_level: str) -> str:
    """Validate threat level"""
    valid_levels = ['safe', 'low', 'medium', 'high', 'critical']
    if threat_level not in valid_levels:
        raise HTTPException(
            status_code=400,
            detail=f"threat_level must be one of {valid_levels}, got {threat_level}"
        )
    return threat_level


def validate_search_type(search_type: str) -> str:
    """Validate search type"""
    valid_types = ['all', 'devices', 'flows', 'threats']
    if search_type not in valid_types:
        raise HTTPException(
            status_code=400,
            detail=f"type must be one of {valid_types}, got {search_type}"
        )
    return search_type


def validate_export_format(format: str) -> str:
    """Validate export format"""
    valid_formats = ['json', 'csv']
    if format.lower() not in valid_formats:
        raise HTTPException(
            status_code=400,
            detail=f"format must be one of {valid_formats}, got {format}"
        )
    return format.lower()


def validate_device_id(device_id: str) -> str:
    """Validate device ID format"""
    if not device_id:
        raise HTTPException(
            status_code=400,
            detail="device_id cannot be empty"
        )
    if len(device_id) > 100:
        raise HTTPException(
            status_code=400,
            detail="device_id is too long (max 100 characters)"
        )
    return device_id


def validate_min_bytes(min_bytes: int) -> int:
    """Validate min_bytes parameter"""
    if min_bytes < 0:
        raise HTTPException(
            status_code=400,
            detail=f"min_bytes must be >= 0, got {min_bytes}"
        )
    return min_bytes


def validate_interval_minutes(interval_minutes: int) -> int:
    """Validate interval_minutes parameter"""
    if interval_minutes < 1:
        raise HTTPException(
            status_code=400,
            detail=f"interval_minutes must be >= 1, got {interval_minutes}"
        )
    if interval_minutes > 1440:  # Max 24 hours
        raise HTTPException(
            status_code=400,
            detail=(
                f"interval_minutes must be <= 1440 (24 hours), "
                f"got {interval_minutes}"
            )
        )
    return interval_minutes


def validate_sort_by(sort_by: str, valid_options: list) -> str:
    """Validate sort_by parameter"""
    if sort_by not in valid_options:
        raise HTTPException(
            status_code=400,
            detail=f"sort_by must be one of {valid_options}, got {sort_by}"
        )
    return sort_by


# FastAPI Query validators using Query() with constraints
def LimitQuery(default: int = 100, max_limit: int = 1000) -> int:
    """Query parameter for limit with validation"""
    return Query(
        default=default,
        ge=1,
        le=max_limit,
        description=f"Number of items to return (1-{max_limit})"
    )


def OffsetQuery(default: int = 0) -> int:
    """Query parameter for offset with validation"""
    return Query(
        default=default,
        ge=0,
        description="Number of items to skip"
    )


def HoursQuery(default: int = 24, max_hours: int = 720) -> int:
    """Query parameter for hours with validation"""
    return Query(
        default=default,
        ge=1,
        le=max_hours,
        description=f"Number of hours to look back (1-{max_hours})"
    )


def IPQuery(description: str = "IP address") -> Optional[str]:
    """Query parameter for IP address with validation"""
    return Query(
        default=None,
        description=description,
        regex=r'^(\d{1,3}\.){3}\d{1,3}$'
    )


def StatusQuery() -> Optional[str]:
    """Query parameter for status with validation"""
    return Query(
        default=None,
        description="Flow status",
        regex='^(active|closed)$'
    )


def ThreatLevelQuery() -> Optional[str]:
    """Query parameter for threat level with validation"""
    return Query(
        default=None,
        description="Threat level",
        regex='^(safe|low|medium|high|critical)$'
    )


def SearchTypeQuery() -> str:
    """Query parameter for search type with validation"""
    return Query(
        default='all',
        description="Search type",
        regex='^(all|devices|flows|threats)$'
    )


def ExportFormatQuery() -> str:
    """Query parameter for export format with validation"""
    return Query(
        default='json',
        description="Export format",
        regex='^(json|csv)$'
    )


def DeviceIdPath() -> str:
    """Path parameter for device ID with validation"""
    return Path(
        ...,
        description="Device ID",
        min_length=1,
        max_length=100
    )


def FlowIdPath() -> str:
    """Path parameter for flow ID with validation"""
    return Path(
        ...,
        description="Flow ID",
        min_length=1,
        max_length=100
    )


def ThreatIdPath() -> str:
    """Path parameter for threat ID with validation"""
    return Path(
        ...,
        description="Threat ID",
        min_length=1,
        max_length=100
    )

