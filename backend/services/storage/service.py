"""
StorageService facade: composes the per-domain repositories below and
preserves the exact public API `storage.py` used to expose directly, so
routers/services/tests don't need to change (`state.storage.get_devices()`
etc. all keep working unchanged).
"""
from typing import Dict, List, Optional

from models.types import NetworkFlow, Device, Threat, FilterPreset
from models.alerts import AlertRule, TriggeredAlert
from models.baseline import DeviceBaseline
from services.storage.base import StorageBase
from services.storage.devices import DeviceRepository
from services.storage.flows import FlowRepository
from services.storage.threats import ThreatRepository
from services.storage.filter_presets import FilterPresetRepository
from services.storage.alerts import AlertRepository
from services.storage.baselines import BaselineRepository


class StorageService(StorageBase):
    """Database storage service using SQLite.

    Connection/pool lifecycle, retry logic, schema creation, and maintenance
    live in `StorageBase` (inherited). Domain-specific query logic lives in
    the per-domain repositories constructed below; every method here is a
    thin delegate to the matching repository method.
    """

    def __init__(self, db_path: str = "netinsight.db", use_pool: bool = True):
        super().__init__(db_path=db_path, use_pool=use_pool)
        self._devices = DeviceRepository(self)
        self._flows = FlowRepository(self)
        self._threats = ThreatRepository(self)
        self._filter_presets = FilterPresetRepository(self)
        self._alerts = AlertRepository(self)
        self._baselines = BaselineRepository(self)

    # Device methods
    async def get_devices(self) -> List[Device]:
        return await self._devices.get_devices()

    async def get_device(self, device_id: str) -> Optional[Device]:
        return await self._devices.get_device(device_id)

    async def get_device_by_mac(self, mac: str) -> Optional[Device]:
        return await self._devices.get_device_by_mac(mac)

    async def upsert_device(self, device: Device):
        return await self._devices.upsert_device(device)

    async def count_devices(self) -> int:
        return await self._devices.count_devices()

    async def search_devices(self, query_text: str, limit: int = 50) -> List[Device]:
        return await self._devices.search_devices(query_text, limit)

    # Flow methods
    async def add_flow(self, flow: NetworkFlow):
        return await self._flows.add_flow(flow)

    async def add_flows_batch(self, flows: List[NetworkFlow]):
        return await self._flows.add_flows_batch(flows)

    async def get_flows(self, limit: int = 100, device_id: Optional[str] = None,
                       status: Optional[str] = None, protocol: Optional[str] = None,
                       start_time: Optional[int] = None, end_time: Optional[int] = None,
                       source_ip: Optional[str] = None, dest_ip: Optional[str] = None,
                       threat_level: Optional[str] = None, min_bytes: Optional[int] = None,
                       offset: int = 0,
                       country: Optional[str] = None,
                       city: Optional[str] = None,
                       application: Optional[str] = None,
                       min_rtt: Optional[int] = None,
                       max_rtt: Optional[int] = None,
                       max_jitter: Optional[float] = None,
                       max_retransmissions: Optional[int] = None,
                       sni: Optional[str] = None,
                       connection_state: Optional[str] = None) -> List[NetworkFlow]:
        return await self._flows.get_flows(
            limit=limit, device_id=device_id, status=status, protocol=protocol,
            start_time=start_time, end_time=end_time, source_ip=source_ip, dest_ip=dest_ip,
            threat_level=threat_level, min_bytes=min_bytes, offset=offset,
            country=country, city=city, application=application,
            min_rtt=min_rtt, max_rtt=max_rtt, max_jitter=max_jitter,
            max_retransmissions=max_retransmissions, sni=sni, connection_state=connection_state,
        )

    async def aggregate_geographic(self, start_time: int) -> List[dict]:
        return await self._flows.aggregate_geographic(start_time)

    async def aggregate_top_domains(self, start_time: int, limit: int = 20) -> List[dict]:
        return await self._flows.aggregate_top_domains(start_time, limit)

    async def aggregate_top_devices(self, start_time: int) -> List[dict]:
        return await self._flows.aggregate_top_devices(start_time)

    async def aggregate_bandwidth_timeline(self, start_time: int, interval_ms: int) -> List[dict]:
        return await self._flows.aggregate_bandwidth_timeline(start_time, interval_ms)

    async def aggregate_device_analytics(self, device_id: str, start_time: int) -> dict:
        return await self._flows.aggregate_device_analytics(device_id, start_time)

    async def aggregate_rtt_trends(
        self,
        start_time: int,
        interval_ms: int,
        device_id: Optional[str] = None,
        country: Optional[str] = None,
    ) -> List[dict]:
        return await self._flows.aggregate_rtt_trends(start_time, interval_ms, device_id, country)

    async def aggregate_jitter_stats(self, start_time: int, device_id: Optional[str] = None) -> dict:
        return await self._flows.aggregate_jitter_stats(start_time, device_id=device_id)

    async def aggregate_retransmission_stats(self, start_time: int, device_id: Optional[str] = None) -> dict:
        return await self._flows.aggregate_retransmission_stats(start_time, device_id=device_id)

    async def aggregate_connection_quality(self, start_time: int, device_id: Optional[str] = None) -> dict:
        return await self._flows.aggregate_connection_quality(start_time, device_id=device_id)

    async def aggregate_analytics_hourly(self, start_time: int) -> Dict[int, dict]:
        return await self._flows.aggregate_analytics_hourly(start_time)

    async def aggregate_protocol_stats(self, start_time: Optional[int] = None) -> List[dict]:
        return await self._flows.aggregate_protocol_stats(start_time)

    async def aggregate_application_breakdown(self, start_time: int, device_id: Optional[str] = None) -> List[dict]:
        return await self._flows.aggregate_application_breakdown(start_time, device_id=device_id)

    async def aggregate_application_trends(
        self, start_time: int, interval_ms: int, application: Optional[str] = None
    ) -> List[dict]:
        return await self._flows.aggregate_application_trends(start_time, interval_ms, application=application)

    async def aggregate_device_application_profile(self, device_id: str, start_time: int) -> List[dict]:
        return await self._flows.aggregate_device_application_profile(device_id, start_time)

    async def search_flows(self, query_text: str, limit: int = 50) -> List[NetworkFlow]:
        return await self._flows.search_flows(query_text, limit)

    async def get_flow(self, flow_id: str) -> Optional[NetworkFlow]:
        return await self._flows.get_flow(flow_id)

    async def count_flows(self) -> int:
        return await self._flows.count_flows()

    async def get_total_bytes_since(self, since_ms: int) -> int:
        return await self._flows.get_total_bytes_since(since_ms)

    async def get_device_flow_aggregates(self, start_time: int, end_time: int) -> List[dict]:
        return await self._flows.get_device_flow_aggregates(start_time, end_time)

    # Threat methods
    async def add_threat(self, threat: Threat):
        return await self._threats.add_threat(threat)

    async def get_threats(self, active_only: bool = True, limit: int = 200) -> List[Threat]:
        return await self._threats.get_threats(active_only=active_only, limit=limit)

    async def aggregate_threat_stats(self) -> dict:
        return await self._threats.aggregate_threat_stats()

    async def aggregate_threat_counts_by_hour(self, start_time: int) -> dict[int, int]:
        return await self._threats.aggregate_threat_counts_by_hour(start_time)

    async def search_threats(
        self, query_text: str, limit: int = 50, active_only: bool = False
    ) -> List[Threat]:
        return await self._threats.search_threats(query_text, limit=limit, active_only=active_only)

    async def get_threat(self, threat_id: str) -> Optional[Threat]:
        return await self._threats.get_threat(threat_id)

    async def upsert_threat(self, threat: Threat):
        return await self._threats.upsert_threat(threat)

    async def dismiss_threat(self, threat_id: str) -> bool:
        return await self._threats.dismiss_threat(threat_id)

    # Filter preset methods
    async def add_filter_preset(self, preset: FilterPreset):
        return await self._filter_presets.add_filter_preset(preset)

    async def get_filter_presets(self, user_id: str) -> List[FilterPreset]:
        return await self._filter_presets.get_filter_presets(user_id)

    async def delete_filter_preset(self, preset_id: str, user_id: str) -> bool:
        return await self._filter_presets.delete_filter_preset(preset_id, user_id)

    # Alert rule methods
    async def add_alert_rule(self, rule: AlertRule):
        return await self._alerts.add_alert_rule(rule)

    async def get_alert_rules(self, user_id: Optional[str] = None, enabled_only: bool = False) -> List[AlertRule]:
        return await self._alerts.get_alert_rules(user_id=user_id, enabled_only=enabled_only)

    async def get_alert_rule(self, rule_id: str) -> Optional[AlertRule]:
        return await self._alerts.get_alert_rule(rule_id)

    async def update_alert_rule(self, rule: AlertRule):
        return await self._alerts.update_alert_rule(rule)

    async def delete_alert_rule(self, rule_id: str, user_id: str) -> bool:
        return await self._alerts.delete_alert_rule(rule_id, user_id)

    # Triggered alert methods
    async def add_triggered_alert(self, alert: TriggeredAlert):
        return await self._alerts.add_triggered_alert(alert)

    async def get_triggered_alerts(self, limit: int = 100, acknowledged: Optional[bool] = None) -> List[TriggeredAlert]:
        return await self._alerts.get_triggered_alerts(limit=limit, acknowledged=acknowledged)

    async def acknowledge_triggered_alert(self, alert_id: str) -> bool:
        return await self._alerts.acknowledge_triggered_alert(alert_id)

    # Device baseline methods (predictive anomaly detection)
    async def upsert_device_baseline(self, baseline: DeviceBaseline):
        return await self._baselines.upsert_device_baseline(baseline)

    async def get_device_baseline(self, device_id: str) -> Optional[DeviceBaseline]:
        return await self._baselines.get_device_baseline(device_id)

    async def get_all_device_baselines(self) -> List[DeviceBaseline]:
        return await self._baselines.get_all_device_baselines()
