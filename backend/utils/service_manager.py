"""
Service initialization and management utilities
Consolidates service initialization patterns
"""
import logging
from typing import Optional, Callable, Any
from services.storage import StorageService
from services.device_fingerprinting import DeviceFingerprintingService
from services.threat_detection import ThreatDetectionService
from services.analytics import AnalyticsService
from services.advanced_analytics import AdvancedAnalyticsService
from services.geolocation import GeolocationService
from services.network_quality_analytics import NetworkQualityAnalyticsService
from services.application_analytics import ApplicationAnalyticsService
from services.packet_capture import PacketCaptureService
from services.enhanced_identification import EnhancedIdentificationService
from models.types import Device, Threat
from utils.config import config

logger = logging.getLogger(__name__)


class ServiceManager:
    """Manages service initialization and lifecycle"""

    def __init__(self, storage: StorageService):
        self.storage = storage
        self.device_service: Optional[DeviceFingerprintingService] = None
        self.threat_service: Optional[ThreatDetectionService] = None
        self.analytics: Optional[AnalyticsService] = None
        self.advanced_analytics: Optional[AdvancedAnalyticsService] = None
        self.geolocation_service: Optional[GeolocationService] = None
        self.network_quality_analytics: Optional[NetworkQualityAnalyticsService] = None
        self.application_analytics: Optional[ApplicationAnalyticsService] = None
        self.packet_capture: Optional[PacketCaptureService] = None

    def initialize_services(
        self,
        on_device_update: Optional[Callable[[Device], Any]] = None,
        on_threat_update: Optional[Callable[[Threat], Any]] = None,
        on_flow_update: Optional[Callable[[Any], Any]] = None,
        network_interface: str = "eth0",
    ):
        """Initialize all services with callbacks"""
        # Initialize services with WebSocket callbacks
        self.device_service = DeviceFingerprintingService(
            self.storage, on_device_update=on_device_update
        )
        self.threat_service = ThreatDetectionService(
            self.storage, on_threat_update=on_threat_update
        )
        self.analytics = AnalyticsService(self.storage)
        self.advanced_analytics = AdvancedAnalyticsService(self.storage)

        # Initialize geolocation service
        self.geolocation_service = GeolocationService()

        # Initialize new analytics services
        self.network_quality_analytics = NetworkQualityAnalyticsService(self.storage)
        self.application_analytics = ApplicationAnalyticsService(self.storage)

        # Initialize enhanced identification service
        enhanced_identification = EnhancedIdentificationService(
            enable_dns_tracking=config.enable_dns_tracking,
            enable_reverse_dns=config.enable_reverse_dns,
            reverse_dns_timeout=config.reverse_dns_timeout,
            reverse_dns_retries=config.reverse_dns_retries,
            enable_service_fingerprinting=config.enable_service_fingerprinting,
            enable_deep_packet_inspection=config.enable_deep_packet_inspection,
            enable_http_host_extraction=config.enable_http_host_extraction,
            enable_alpn_detection=config.enable_alpn_detection,
            dns_servers=config.dns_servers if config.dns_servers else None
        )

        # Initialize packet capture
        self.packet_capture = PacketCaptureService(
            interface=network_interface,
            device_service=self.device_service,
            threat_service=self.threat_service,
            storage=self.storage,
            geolocation_service=self.geolocation_service,
            on_flow_update=on_flow_update,
            enhanced_identification=enhanced_identification,
        )

        logger.info("All services initialized successfully")

    async def cleanup(self):
        """Cleanup all services"""
        if self.packet_capture:
            await self.packet_capture.stop()
        if self.storage:
            await self.storage.close()
        if self.geolocation_service:
            self.geolocation_service.close()
        logger.info("All services cleaned up")

