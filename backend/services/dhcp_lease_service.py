"""
DHCP lease enrichment service.

Reads the router's dnsmasq lease file over a dedicated, command-restricted SSH
key (the router's authorized_keys forces `cat <leasefile>`, so this key can
never do anything else even if it leaked) to resolve device hostnames that
reverse DNS didn't catch. Optional - if unconfigured, get_hostname() always
returns None and callers fall back to their existing resolution path.
"""
import asyncio
import logging
import time
from typing import Dict, Optional

logger = logging.getLogger(__name__)

FETCH_TIMEOUT_SECONDS = 10.0
DEFAULT_CACHE_TTL_SECONDS = 300.0


class DhcpLeaseService:
    """Fetches and parses dnsmasq DHCP leases from a remote router via SSH."""

    def __init__(
        self,
        host: str = "",
        user: str = "root",
        ssh_key: str = "",
        cache_ttl_seconds: float = DEFAULT_CACHE_TTL_SECONDS,
    ):
        self.host = host
        self.user = user
        self.ssh_key = ssh_key
        self.cache_ttl_seconds = cache_ttl_seconds
        self._mac_to_hostname: Dict[str, str] = {}
        self._last_fetch: float = 0.0
        self._lock = asyncio.Lock()

    @property
    def is_configured(self) -> bool:
        return bool(self.host and self.ssh_key)

    async def get_hostname(self, mac: str) -> Optional[str]:
        """Return the DHCP-supplied hostname for a MAC, refreshing the cache
        if stale. Returns None if unconfigured, unknown, or the client never
        sent a hostname (dnsmasq records that as '*')."""
        if not self.is_configured or not mac or mac == "unknown":
            return None
        await self._refresh_if_stale()
        return self._mac_to_hostname.get(mac.lower())

    async def _refresh_if_stale(self) -> None:
        async with self._lock:
            if time.monotonic() - self._last_fetch < self.cache_ttl_seconds:
                return
            await self._fetch_leases()

    async def _fetch_leases(self) -> None:
        cmd = [
            "ssh",
            "-i", self.ssh_key,
            "-o", "StrictHostKeyChecking=accept-new",
            "-o", "BatchMode=yes",
            "-o", "ConnectTimeout=8",
            f"{self.user}@{self.host}",
        ]
        # Mark the attempt now regardless of outcome, so a persistent failure
        # (unreachable router, revoked key) can't retry on every single call.
        self._last_fetch = time.monotonic()
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(), timeout=FETCH_TIMEOUT_SECONDS
            )
        except (asyncio.TimeoutError, OSError) as e:
            logger.warning(f"DHCP lease fetch from {self.host} failed: {e}")
            return

        if proc.returncode != 0:
            logger.warning(
                f"DHCP lease fetch from {self.host} exited {proc.returncode}: "
                f"{stderr.decode('utf-8', errors='ignore').strip()}"
            )
            return

        self._mac_to_hostname = self._parse_leases(stdout.decode("utf-8", errors="ignore"))
        logger.info(
            f"Refreshed DHCP lease cache from {self.host}: "
            f"{len(self._mac_to_hostname)} named lease(s)"
        )

    @staticmethod
    def _parse_leases(text: str) -> Dict[str, str]:
        """Parse dnsmasq lease lines: `<expiry> <mac> <ip> <hostname> <client_id>`.
        A hostname of '*' means the client sent none - not a usable name."""
        result: Dict[str, str] = {}
        for line in text.splitlines():
            parts = line.split()
            if len(parts) < 4:
                continue
            mac, hostname = parts[1].lower(), parts[3]
            if hostname and hostname != "*":
                result[mac] = hostname
        return result
