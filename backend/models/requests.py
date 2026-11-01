"""
Request models for API endpoints
"""

from pydantic import BaseModel, Field


class FlowQueryParams(BaseModel):
    """Query parameters for flow filtering"""
    limit: int = Field(default=100, ge=1, le=1000)
    offset: int = Field(default=0, ge=0)
    device_id: str | None = Field(None, min_length=1, max_length=100)
    status: str | None = Field(None, pattern="^(active|closed)$")
    protocol: str | None = Field(None, min_length=1, max_length=20)
    start_time: int | None = Field(None, ge=0)  # Unix timestamp in ms
    end_time: int | None = Field(None, ge=0)
    source_ip: str | None = Field(None, pattern="^\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}$")
    dest_ip: str | None = Field(None, pattern="^\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}$")
    threat_level: str | None = Field(None, pattern="^(safe|low|medium|high|critical)$")
    min_bytes: int | None = Field(None, ge=0)


class DeviceUpdateRequest(BaseModel):
    """Request model for updating device"""
    name: str | None = None
    notes: str | None = None
    type: str | None = None
    tags: list[str] | None = None


class FilterPresetCreate(BaseModel):
    """Request model for creating a saved flow filter preset"""
    name: str = Field(..., min_length=1, max_length=100)
    filters: dict


class TimeRangeRequest(BaseModel):
    """Request model for time range queries"""
    start_time: int | None = None  # Unix timestamp in ms
    end_time: int | None = None
    hours: int | None = Field(default=24, ge=1, le=720)  # Max 30 days
    days: int | None = Field(default=None, ge=1, le=30)


class ExportRequest(BaseModel):
    """Request model for data export"""
    format: str = Field(default="json", pattern="^(json|csv)$")
    start_time: int | None = None
    end_time: int | None = None
    device_ids: list[str] | None = None
    include_fields: list[str] | None = None


class SearchRequest(BaseModel):
    """Request model for search"""
    query: str = Field(..., min_length=1, max_length=200)
    type: str = Field(default="all", pattern="^(all|devices|flows|threats)$")
    limit: int = Field(default=50, ge=1, le=200)

