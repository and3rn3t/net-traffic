"""
Baseline learning and predictive anomaly detection service.

Learns a per-device behavioral baseline (mean + standard deviation, updated
via exponential moving average) for a handful of flow-derived metrics, and
flags statistically significant deviations above that baseline as predictive
anomalies (creating a Threat, type='anomaly').

Runs periodically (see main.py's _periodic_baseline_learning), not on the
packet-capture hot path - this only aggregates flow activity over the last
learning window (SQL-side, via storage.get_device_flow_aggregates), so it
adds no per-packet overhead.
"""
import logging
import math
import time
import uuid
from datetime import datetime
from typing import Callable, Dict, List, Optional

from models.baseline import DeviceBaseline
from models.types import Threat
from services.storage import StorageService
from utils.constants import (
    BASELINE_ANOMALY_COOLDOWN_MINUTES,
    BASELINE_ANOMALY_Z_THRESHOLD,
    BASELINE_EMA_ALPHA,
    BASELINE_MIN_SAMPLES,
    BASELINE_MIN_STDDEV,
)

logger = logging.getLogger(__name__)

# (metric key, mean attr, stddev attr, human label)
_METRICS = (
    ("bytesTotal", "bytesTotalMean", "bytesTotalStdDev", "total bytes"),
    ("connections", "connectionsMean", "connectionsStdDev", "connection count"),
    ("avgRtt", "avgRttMean", "avgRttStdDev", "average RTT"),
    ("avgJitter", "avgJitterMean", "avgJitterStdDev", "average jitter"),
    ("retransmissionRate", "retransmissionRateMean", "retransmissionRateStdDev", "retransmission rate"),
)


class BaselineLearningService:
    def __init__(self, storage: StorageService, on_threat_update: Optional[Callable] = None):
        self.storage = storage
        self.on_threat_update = on_threat_update
        self._baselines: Dict[str, DeviceBaseline] = {}
        self._last_anomaly_notified: Dict[str, float] = {}

    async def load_baselines(self) -> None:
        """Load persisted baselines into the in-memory cache (call at startup)."""
        baselines = await self.storage.get_all_device_baselines()
        self._baselines = {b.deviceId: b for b in baselines}
        logger.info(f"Loaded {len(self._baselines)} device baselines")

    def get_baselines(self) -> List[DeviceBaseline]:
        """Return all currently known device baselines."""
        return list(self._baselines.values())

    def get_baseline(self, device_id: str) -> Optional[DeviceBaseline]:
        return self._baselines.get(device_id)

    async def run_cycle(self, window_hours: int = 1) -> None:
        """Aggregate the last window's flow activity per device, update each
        device's baseline, and flag statistically significant deviations."""
        now_ms = int(datetime.now().timestamp() * 1000)
        start_time = now_ms - window_hours * 3600 * 1000

        try:
            aggregates = await self.storage.get_device_flow_aggregates(start_time, now_ms)
        except Exception:
            logger.exception("Failed to aggregate flow activity for baseline learning")
            return

        for row in aggregates:
            await self._process_device_aggregate(row, now_ms)

    async def _process_device_aggregate(self, row: dict, now_ms: int) -> None:
        """Update one device's baseline (and flag anomalies) from its aggregate row."""
        device_id = row.get("device_id")
        if not device_id:
            return

        current_values = self._extract_current_values(row)
        baseline = self._baselines.get(device_id) or DeviceBaseline(deviceId=device_id)

        if baseline.sampleCount >= BASELINE_MIN_SAMPLES:
            await self._detect_anomalies(device_id, baseline, current_values)

        self._update_baseline(baseline, current_values)
        baseline.updatedAt = now_ms
        self._baselines[device_id] = baseline

        try:
            await self.storage.upsert_device_baseline(baseline)
        except Exception:
            logger.exception(f"Failed to persist baseline for device {device_id}")

    @staticmethod
    def _extract_current_values(row: dict) -> Dict[str, float]:
        total_packets = row.get("total_packets") or 0
        total_retransmissions = row.get("total_retransmissions") or 0
        return {
            "bytesTotal": float(row.get("bytes_total") or 0),
            "connections": float(row.get("connections") or 0),
            "avgRtt": float(row.get("avg_rtt") or 0),
            "avgJitter": float(row.get("avg_jitter") or 0),
            "retransmissionRate": (
                (total_retransmissions / total_packets) * 100 if total_packets > 0 else 0.0
            ),
        }

    def _update_baseline(self, baseline: DeviceBaseline, current_values: Dict[str, float]) -> None:
        """Update mean/stddev in place via exponential moving average."""
        for metric, mean_attr, stddev_attr, _label in _METRICS:
            current = current_values[metric]
            old_mean = getattr(baseline, mean_attr)
            old_stddev = getattr(baseline, stddev_attr)

            new_mean = BASELINE_EMA_ALPHA * current + (1 - BASELINE_EMA_ALPHA) * old_mean
            variance = (
                BASELINE_EMA_ALPHA * (current - new_mean) ** 2
                + (1 - BASELINE_EMA_ALPHA) * old_stddev ** 2
            )

            setattr(baseline, mean_attr, new_mean)
            setattr(baseline, stddev_attr, math.sqrt(max(variance, 0.0)))

        baseline.sampleCount += 1

    async def _detect_anomalies(
        self, device_id: str, baseline: DeviceBaseline, current_values: Dict[str, float]
    ) -> None:
        for metric, mean_attr, stddev_attr, label in _METRICS:
            current = current_values[metric]
            mean = getattr(baseline, mean_attr)
            stddev = max(getattr(baseline, stddev_attr), BASELINE_MIN_STDDEV.get(metric, 1.0))

            # Only flag spikes above baseline - a drop in traffic isn't a
            # security concern and would otherwise double the false-positive rate.
            if current <= mean:
                continue

            z_score = (current - mean) / stddev
            if z_score < BASELINE_ANOMALY_Z_THRESHOLD:
                continue

            cooldown_key = f"{device_id}:{metric}"
            last_notified = self._last_anomaly_notified.get(cooldown_key, 0.0)
            if time.monotonic() - last_notified < BASELINE_ANOMALY_COOLDOWN_MINUTES * 60:
                continue
            self._last_anomaly_notified[cooldown_key] = time.monotonic()

            await self._create_anomaly_threat(device_id, label, current, mean, z_score)

    async def _create_anomaly_threat(
        self, device_id: str, label: str, current: float, mean: float, z_score: float
    ) -> None:
        try:
            threat = Threat(
                id=str(uuid.uuid4()),
                timestamp=int(datetime.now().timestamp() * 1000),
                type="anomaly",
                severity="high" if z_score >= BASELINE_ANOMALY_Z_THRESHOLD * 1.5 else "medium",
                deviceId=device_id,
                flowId="n/a",
                description=(
                    f"Predictive anomaly: {label} is {current:.1f}, "
                    f"{z_score:.1f} standard deviations above this device's learned "
                    f"baseline ({mean:.1f})"
                ),
                recommendation=(
                    "Review this device's recent activity for unexpected behavior "
                    "such as new applications, malware, or a compromised account."
                ),
                dismissed=False,
            )
            await self.storage.add_threat(threat)
            logger.warning(f"Predictive anomaly detected: {threat.description}")

            if self.on_threat_update:
                await self.on_threat_update(threat)
        except Exception:
            logger.exception(f"Failed to create predictive anomaly threat for device {device_id}")
