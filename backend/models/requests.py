"""
Request models for API endpoints
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class FlowQueryParams(BaseModel):
    """Query parameters for flow filtering"""
    limit: int = Field(default=100, ge=1, le=1000)
    offset: int = Field(default=0, ge=0)
    device_id: Optional[str] = Field(None, min_length=1, max_length=100)
    status: Optional[str] = Field(None, pattern="^(active|closed)$")
    protocol: Optional[str] = Field(None, min_length=1, max_length=20)
    start_time: Optional[int] = Field(None, ge=0)  # Unix timestamp in ms
    end_time: Optional[int] = Field(None, ge=0)
    source_ip: Optional[str] = Field(None, pattern="^\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}$")
    dest_ip: Optional[str] = Field(None, pattern="^\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}$")
    threat_level: Optional[str] = Field(None, pattern="^(safe|low|medium|high|critical)$")
    min_bytes: Optional[int] = Field(None, ge=0)


class DeviceUpdateRequest(BaseModel):
    """Request model for updating device"""
    name: Optional[str] = None
    notes: Optional[str] = None
    type: Optional[str] = None


class TimeRangeRequest(BaseModel):
    """Request model for time range queries"""
    start_time: Optional[int] = None  # Unix timestamp in ms
    end_time: Optional[int] = None
    hours: Optional[int] = Field(default=24, ge=1, le=720)  # Max 30 days
    days: Optional[int] = Field(default=None, ge=1, le=30)


class ExportRequest(BaseModel):
    """Request model for data export"""
    format: str = Field(default="json", pattern="^(json|csv)$")
    start_time: Optional[int] = None
    end_time: Optional[int] = None
    device_ids: Optional[List[str]] = None
    include_fields: Optional[List[str]] = None


class SearchRequest(BaseModel):
    """Request model for search"""
    query: str = Field(..., min_length=1, max_length=200)
    type: str = Field(default="all", pattern="^(all|devices|flows|threats)$")
    limit: int = Field(default=50, ge=1, le=200)

