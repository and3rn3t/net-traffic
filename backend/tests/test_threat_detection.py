"""Threat scoring, classification and threat-record creation."""

from models.types import Threat
from services.threat_detection import ThreatDetectionService
from utils.constants import EARLY_RESET_PACKET_THRESHOLD, LARGE_UPLOAD_BYTES


class FakeStorage:
    def __init__(self, fail: bool = False) -> None:
        self.threats: list[Threat] = []
        self.fail = fail

    async def add_threat(self, threat: Threat) -> None:
        if self.fail:
            raise RuntimeError("db unavailable")
        self.threats.append(threat)


def benign_flow(**overrides: object) -> dict:
    flow = {
        "id": "flow-1",
        "device_id": "dev-1",
        "source_ip": "192.168.1.20",
        "dest_ip": "93.184.216.34",
        "dest_port": 443,
        "bytes_in": 50_000,
        "bytes_out": 5_000,
        "packets_in": 40,
        "packets_out": 30,
        "tcp_flags": ["SYN", "ACK", "FIN"],
        "connection_state": "CLOSED",
        "retransmissions": 0,
        "application": "HTTPS",
        "sni": "example.com",
    }
    flow.update(overrides)
    return flow


async def test_benign_flow_is_safe_and_records_nothing() -> None:
    storage = FakeStorage()
    service = ThreatDetectionService(storage)

    assert await service.analyze_flow(benign_flow()) == "safe"
    assert storage.threats == []


async def test_suspicious_port_is_high_and_notifies() -> None:
    storage = FakeStorage()
    notified: list[Threat] = []

    async def on_threat(threat: Threat) -> None:
        notified.append(threat)

    service = ThreatDetectionService(storage, on_threat_update=on_threat)

    assert await service.analyze_flow(benign_flow(dest_port=4444)) == "high"
    assert len(storage.threats) == 1
    threat = storage.threats[0]
    assert threat.severity == "high"
    assert threat.deviceId == "dev-1"
    assert threat.flowId == "flow-1"
    assert notified == [threat]


async def test_large_upload_is_classified_as_exfiltration() -> None:
    storage = FakeStorage()
    service = ThreatDetectionService(storage)

    level = await service.analyze_flow(benign_flow(bytes_out=LARGE_UPLOAD_BYTES + 1))

    assert level == "medium"
    assert storage.threats[0].type == "exfiltration"
    assert "MB to example.com" in storage.threats[0].description


async def test_only_abrupt_resets_are_scored() -> None:
    service = ThreatDetectionService(FakeStorage())
    reset = {"tcp_flags": ["SYN", "ACK", "RST"], "connection_state": "RESET"}

    abrupt = benign_flow(**reset, packets_in=2, packets_out=2)
    assert abrupt["packets_in"] + abrupt["packets_out"] < EARLY_RESET_PACKET_THRESHOLD
    assert await service.analyze_flow(abrupt) == "low"

    # Most real connections end via RST after a normal transfer - not a threat.
    assert await service.analyze_flow(benign_flow(**reset)) == "safe"


async def test_rst_without_syn_is_classified_as_scan() -> None:
    storage = FakeStorage()
    service = ThreatDetectionService(storage)

    level = await service.analyze_flow(benign_flow(tcp_flags=["RST"]))

    assert level == "low"
    assert storage.threats[0].type == "scan"


async def test_rtt_sample_list_is_averaged() -> None:
    service = ThreatDetectionService(FakeStorage())

    # Average 1500 ms exceeds HIGH_RTT_MS; on its own that's below the "low" cut-off.
    assert await service.analyze_flow(benign_flow(rtt=[1000, 2000])) == "safe"
    assert await service.analyze_flow(benign_flow(rtt=[])) == "safe"


async def test_suspicious_domain_is_classified_as_phishing() -> None:
    storage = FakeStorage()
    service = ThreatDetectionService(storage)

    level = await service.analyze_flow(benign_flow(sni="login-update.tk"))

    assert level == "medium"
    assert storage.threats[0].type == "phishing"


async def test_storage_failure_does_not_raise() -> None:
    service = ThreatDetectionService(FakeStorage(fail=True))

    assert await service.analyze_flow(benign_flow(dest_port=4444)) == "high"
