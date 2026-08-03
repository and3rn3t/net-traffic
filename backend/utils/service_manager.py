"""
Service initialization and management utilities
Consolidates service initialization patterns
"""
import logging
from typing import Optional, Callable, Any
from services.storage import StorageService
from services.device_fingerprinting import DeviceFingerprintingService
from services.oui_lookup import OuiLookup
from services.dhcp_lease_service import DhcpLeaseService
from services.threat_detection import ThreatDetectionService
from services.analytics import AnalyticsService
from services.geolocation import GeolocationService
from services.packet_capture import PacketCaptureService
from services.enhanced_identification import EnhancedIdentificationService
from services.alerting import AlertingService
from services.baseline_learning import BaselineLearningService
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
        self.advanced_analytics: Optional[AnalyticsService] = None
        self.geolocation_service: Optional[GeolocationService] = None
        self.network_quality_analytics: Optional[AnalyticsService] = None
        self.application_analytics: Optional[AnalyticsService] = None
        self.packet_capture: Optional[PacketCaptureService] = None
        self.alerting_service: Optional[AlertingService] = None
        self.baseline_learning_service: Optional[BaselineLearningService] = None

    def initialize_services(
        self,
        on_device_update: Optional[Callable[[Device], Any]] = None,
        on_threat_update: Optional[Callable[[Threat], Any]] = None,
        on_flow_update: Optional[Callable[[Any], Any]] = None,
        on_alert_triggered: Optional[Callable[[Any], Any]] = None,
        network_interface: str = "eth0",
        capture_mode: str = "local",
        remote_capture_host: str = "",
        remote_capture_user: str = "root",
        remote_capture_interface: str = "eth0",
        remote_capture_ssh_key: str = "",
    ):
        """Initialize all services with callbacks"""
        # Initialize services with WebSocket callbacks
        self.device_service = DeviceFingerprintingService(
            self.storage,
            on_device_update=on_device_update,
            on_threat_update=on_threat_update,
            oui_lookup=OuiLookup(db_path=config.oui_db_path),
            dhcp_lease_service=DhcpLeaseService(
                host=config.dhcp_lease_host,
                user=config.dhcp_lease_user,
                ssh_key=config.dhcp_lease_ssh_key,
            ),
        )
        self.threat_service = ThreatDetectionService(
            self.storage, on_threat_update=on_threat_update
        )
        self.baseline_learning_service = BaselineLearningService(
            self.storage, on_threat_update=on_threat_update
        )
        # AnalyticsService consolidates what used to be 4 separate classes
        # (analytics/advanced_analytics/network_quality_analytics/
        # application_analytics) - all 4 attribute names below point at the
        # same instance so every existing state.<name>.method() call site
        # keeps working unchanged.
        self.analytics = AnalyticsService(self.storage)
        self.advanced_analytics = self.analytics
        self.network_quality_analytics = self.analytics
        self.application_analytics = self.analytics

        # Initialize geolocation service
        self.geolocation_service = GeolocationService(db_path=config.geoip_db_path)

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

        # Initialize configurable alert rule engine
        self.alerting_service = AlertingService(
            self.storage, on_alert_triggered=on_alert_triggered
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
            alerting_service=self.alerting_service,
            capture_mode=capture_mode,
            remote_host=remote_capture_host,
            remote_user=remote_capture_user,
            remote_interface=remote_capture_interface,
            remote_ssh_key=remote_capture_ssh_key,
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

