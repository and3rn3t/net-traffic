"""
Custom exceptions for the application
"""


class NetInsightException(Exception):
    """Base exception for NetInsight"""
    pass


class StorageError(NetInsightException):
    """Storage/database related errors"""
    pass


class PacketCaptureError(NetInsightException):
    """Packet capture related errors"""
    pass


class ConfigurationError(NetInsightException):
    """Configuration related errors"""
    pass


class ServiceNotInitializedError(NetInsightException):
    """Service not initialized error"""
    pass

