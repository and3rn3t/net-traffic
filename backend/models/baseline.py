"""
Models for per-device behavioral baselines and predictive anomaly detection.

Baselines are learned incrementally (exponential moving average of mean and
variance) from periodic aggregates of a device's flow activity, rather than
computed per-packet - this keeps baseline learning off the packet-capture hot
path (see services/baseline_learning.py).
"""
from pydantic import BaseModel

# Metrics tracked per device. Keep in sync with DeviceBaseline fields below.
BASELINE_METRICS = (
    "bytesTotal",
    "connections",
    "avgRtt",
    "avgJitter",
    "retransmissionRate",
)


class DeviceBaseline(BaseModel):
    deviceId: str
    bytesTotalMean: float = 0.0
    bytesTotalStdDev: float = 0.0
    connectionsMean: float = 0.0
    connectionsStdDev: float = 0.0
    avgRttMean: float = 0.0
    avgRttStdDev: float = 0.0
    avgJitterMean: float = 0.0
    avgJitterStdDev: float = 0.0
    retransmissionRateMean: float = 0.0
    retransmissionRateStdDev: float = 0.0
    sampleCount: int = 0
    updatedAt: int = 0
