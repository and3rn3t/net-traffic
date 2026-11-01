"""Device discovery, vendor/type inference and naming."""

import socket

import pytest

from models.types import Device, Threat
from services.device_fingerprinting import DeviceFingerprintingService


class FakeOuiLookup:
    def __init__(self, vendors: dict[str, str] | None = None) -> None:
        self.vendors = vendors or {}

    def lookup(self, mac: str) -> str | None:
        return self.vendors.get(mac.upper())


class FakeDhcpLeases:
    def __init__(self, hostnames: dict[str, str] | None = None) -> None:
        self.hostnames = hostnames or {}

    async def get_hostname(self, mac: str) -> str | None:
        return self.hostnames.get(mac)


@pytest.fixture(autouse=True)
def no_reverse_dns(monkeypatch: pytest.MonkeyPatch) -> None:
    def fail(ip: str) -> tuple[str, list[str], list[str]]:
        raise socket.herror("no PTR record")

    monkeypatch.setattr(socket, "gethostbyaddr", fail)


def make_service(
    storage,
    vendors: dict[str, str] | None = None,
    hostnames: dict[str, str] | None = None,
    **callbacks,
) -> DeviceFingerprintingService:
    return DeviceFingerprintingService(
        storage,
        oui_lookup=FakeOuiLookup(vendors),
        dhcp_lease_service=FakeDhcpLeases(hostnames),
        **callbacks,
    )


async def test_new_device_uses_dhcp_hostname_and_infers_type(storage) -> None:
    mac = "AA:BB:CC:00:00:01"
    service = make_service(storage, vendors={mac: "Apple, Inc."}, hostnames={mac: "Office-iPhone"})

    device = await service.get_or_create_device("192.168.1.50", mac)

    assert device.name == "Office-iPhone"
    assert device.vendor == "Apple, Inc."
    assert device.type == "smartphone"
    assert (await storage.get_device_by_mac(mac)).id == device.id


async def test_known_mac_returns_existing_device(storage) -> None:
    mac = "AA:BB:CC:00:00:02"
    service = make_service(storage)

    first = await service.get_or_create_device("192.168.1.51", mac)
    second = await service.get_or_create_device("192.168.1.51", mac)

    assert second.id == first.id
    assert len(await storage.get_devices()) == 1


async def test_new_device_raises_low_severity_alert(storage) -> None:
    alerts: list[Threat] = []
    updates: list[Device] = []

    async def on_threat(threat: Threat) -> None:
        alerts.append(threat)

    async def on_device(device: Device) -> None:
        updates.append(device)

    service = make_service(storage, on_threat_update=on_threat, on_device_update=on_device)

    device = await service.get_or_create_device("192.168.1.52", "AA:BB:CC:00:00:03")

    assert updates == [device]
    assert len(alerts) == 1
    assert alerts[0].type == "new_device"
    assert alerts[0].severity == "low"
    assert alerts[0].deviceId == device.id


@pytest.mark.parametrize(
    ("ip", "mac", "vendor", "hostname", "expected"),
    [
        ("192.168.1.1", "AA:BB:CC:00:00:04", "Unknown", None, "server"),  # gateway
        ("192.168.1.60", "DC:A6:32:00:00:01", "Unknown", None, "server"),  # Raspberry Pi OUI
        ("192.168.1.61", "AA:BB:CC:00:00:05", "Apple", "Living-Room-AppleTV", "iot"),
        ("192.168.1.62", "AA:BB:CC:00:00:06", "Espressif Inc.", None, "iot"),
        ("192.168.1.63", "AA:BB:CC:00:00:07", "Ubiquiti Inc", None, "server"),
        ("192.168.1.64", "AA:BB:CC:00:00:08", "Apple", None, "unknown"),
    ],
)
def test_detect_device_type(
    storage, ip: str, mac: str, vendor: str, hostname: str | None, expected: str
) -> None:
    service = make_service(storage)

    assert service._detect_device_type(ip, mac, vendor, hostname) == expected


def test_fallback_name_prefers_vendor_over_ip(storage) -> None:
    service = make_service(storage)

    assert service._fallback_device_name("192.168.1.70", "Sonos", "iot") == "Sonos Iot"
    assert service._fallback_device_name("192.168.1.70", "Unknown", "unknown") == "Device 70"


async def test_backfill_upgrades_fallback_name_and_vendor(storage) -> None:
    mac = "AA:BB:CC:00:00:09"
    service = make_service(storage)
    device = await service.get_or_create_device("192.168.1.71", mac)
    assert device.name == "Device 71"

    upgraded = make_service(storage, vendors={mac: "Sonos, Inc."}, hostnames={mac: "Kitchen"})
    assert await upgraded.backfill_vendor_and_type() == 1

    stored = await storage.get_device_by_mac(mac)
    assert stored.name == "Kitchen"
    assert stored.vendor == "Sonos, Inc."
    assert stored.type == "iot"
