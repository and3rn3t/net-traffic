"""Storage CRUD and SQL-aggregate coverage."""
import pytest

from models.types import Device, NetworkFlow, Threat


def make_device(device_id: str = "dev-1", ip: str = "10.0.0.1", mac: str = "AA:BB:CC:DD:EE:FF") -> Device:
    return Device(
        id=device_id,
        name="Test Device",
        ip=ip,
        mac=mac,
        type="laptop",
        vendor="Test Vendor",
        firstSeen=1_700_000_000_000,
        lastSeen=1_700_000_000_000,
        bytesTotal=0,
        connectionsCount=0,
        threatScore=0.0,
        behavioral={},
    )


def make_flow(flow_id: str = "flow-1", device_id: str = "dev-1", timestamp: int = 1_700_000_000_000) -> NetworkFlow:
    return NetworkFlow(
        id=flow_id,
        timestamp=timestamp,
        sourceIp="10.0.0.1",
        sourcePort=12345,
        destIp="93.184.216.34",
        destPort=443,
        protocol="TCP",
        bytesIn=1000,
        bytesOut=500,
        packetsIn=10,
        packetsOut=5,
        duration=1000,
        status="closed",
        threatLevel="safe",
        deviceId=device_id,
    )


def make_threat(threat_id: str = "threat-1", device_id: str = "dev-1", severity: str = "high", type_: str = "anomaly") -> Threat:
    return Threat(
        id=threat_id,
        timestamp=1_700_000_000_000,
        type=type_,
        severity=severity,
        deviceId=device_id,
        flowId="flow-1",
        description="Test threat",
        recommendation="Investigate",
    )


@pytest.mark.asyncio
async def test_upsert_and_get_device(storage):
    await storage.upsert_device(make_device())
    device = await storage.get_device("dev-1")
    assert device is not None
    assert device.ip == "10.0.0.1"


@pytest.mark.asyncio
async def test_get_devices_returns_all(storage):
    await storage.upsert_device(make_device("dev-1", "10.0.0.1", "AA:BB:CC:DD:EE:01"))
    await storage.upsert_device(make_device("dev-2", "10.0.0.2", "AA:BB:CC:DD:EE:02"))
    devices = await storage.get_devices()
    assert {d.id for d in devices} == {"dev-1", "dev-2"}


@pytest.mark.asyncio
async def test_add_flow_and_aggregate_by_device(storage):
    await storage.upsert_device(make_device())
    await storage.add_flow(make_flow("flow-1", timestamp=1_700_000_000_000))
    await storage.add_flow(make_flow("flow-2", timestamp=1_700_000_001_000))

    aggregates = await storage.get_device_flow_aggregates(0, 2_000_000_000_000)

    assert len(aggregates) == 1
    row = aggregates[0]
    assert row["device_id"] == "dev-1"
    assert row["connections"] == 2
    assert row["bytes_total"] == 2 * (1000 + 500)


@pytest.mark.asyncio
async def test_add_threat_and_get_threats(storage):
    await storage.upsert_device(make_device())
    await storage.add_threat(make_threat())
    threats = await storage.get_threats(active_only=False)
    assert len(threats) == 1
    assert threats[0].id == "threat-1"


@pytest.mark.asyncio
async def test_add_threat_dedups_same_type_and_device(storage):
    """Repeated same type+device threats bump occurrence_count instead of
    inserting a new row (avoids near-duplicate rows for a chatty offender)."""
    await storage.upsert_device(make_device())
    await storage.add_threat(make_threat("threat-1"))
    await storage.add_threat(make_threat("threat-2"))  # same type+device+window

    threats = await storage.get_threats(active_only=False)

    assert len(threats) == 1
    assert threats[0].occurrenceCount == 2


@pytest.mark.asyncio
async def test_aggregate_threat_stats(storage):
    await storage.upsert_device(make_device())
    await storage.add_threat(make_threat("threat-1", severity="critical", type_="anomaly"))
    await storage.add_threat(make_threat("threat-2", severity="low", type_="scan"))

    stats = await storage.aggregate_threat_stats()

    assert stats["total"] == 2
    assert stats["active"] == 2
    assert stats["critical_active"] == 1
