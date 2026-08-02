"""
Offline MAC OUI vendor lookup using the Wireshark/IEEE "manuf" database.

The manuf file format is tab-delimited: `<block>\t<short-name>\t<long-name>`,
where `<block>` is a MAC prefix optionally suffixed with a CIDR-style bit
length for non-standard allocation sizes, e.g. `AC:DE:48:00:00:00/28`.
Download a copy via `scripts/update-oui-db.sh`.
"""
import logging
import os
import re
from typing import Dict, Optional

logger = logging.getLogger(__name__)

_DEFAULT_PATHS = [
    os.path.join(os.path.dirname(__file__), "..", "data", "manuf"),
    "/usr/share/wireshark/manuf",
    "/usr/local/share/wireshark/manuf",
]

# A MAC has no registered vendor OUI if bit 0x02 of the first octet is set -
# iOS/Android/Windows MAC privacy randomization sets this bit intentionally,
# so these will never resolve regardless of database completeness.
_LOCALLY_ADMINISTERED_BIT = 0x02
PRIVATE_RANDOMIZED_VENDOR = "Private (Randomized)"

# The manuf file's short-name column is truncated to ~13 chars (e.g.
# "HewlettPacka", "ArloTechnolo") - the long-name column is used for display
# instead, with a single trailing corporate suffix stripped for a cleaner badge.
_CORP_SUFFIX_RE = re.compile(
    r",?\s+(Inc|LLC|Ltd|Co|Corporation|Corp|GmbH|S\.A\.|B\.V\.|Pte\.?\s*Ltd)\.?$",
    re.IGNORECASE,
)


class OuiLookup:
    """Resolves a MAC address to its registered vendor via an offline OUI database."""

    def __init__(self, db_path: Optional[str] = None):
        self._prefixes: Dict[str, str] = {}
        self.loaded_path: Optional[str] = None
        self._load(db_path)

    def _load(self, db_path: Optional[str]) -> None:
        candidates = [db_path, *_DEFAULT_PATHS] if db_path else _DEFAULT_PATHS
        for path in candidates:
            if path and os.path.isfile(path):
                try:
                    self._parse_file(path)
                except OSError as e:
                    logger.debug(f"Could not read OUI database at {path}: {e}")
                    continue
                self.loaded_path = path
                logger.info(f"OUI vendor database loaded: {path} ({len(self._prefixes)} entries)")
                return
        logger.warning(
            "OUI vendor database not found - device vendors will fall back to "
            "'Unknown'. Run scripts/update-oui-db.sh to download one."
        )

    def _parse_file(self, path: str) -> None:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                parts = line.split("\t")
                if len(parts) < 2:
                    parts = line.split(None, 2)
                if len(parts) < 2:
                    continue
                block = parts[0].strip()
                short_name = parts[1].strip()
                long_name = parts[2].strip() if len(parts) > 2 else ""
                prefix_hex = block.split("/")[0].replace(":", "").replace("-", "").upper()
                vendor = _CORP_SUFFIX_RE.sub("", long_name).strip() or short_name
                if not prefix_hex or not vendor:
                    continue
                self._prefixes[prefix_hex] = vendor

    @property
    def is_loaded(self) -> bool:
        return bool(self._prefixes)

    def lookup(self, mac: str) -> Optional[str]:
        """Return the vendor short name for a MAC address, or None if unresolvable."""
        if not mac or mac == "unknown":
            return None
        hex_mac = mac.replace(":", "").replace("-", "").upper()
        if len(hex_mac) < 6:
            return None
        try:
            first_octet = int(hex_mac[0:2], 16)
        except ValueError:
            return None
        if first_octet & _LOCALLY_ADMINISTERED_BIT:
            return PRIVATE_RANDOMIZED_VENDOR
        # Prefer the most specific allocation size (36-bit, then 28-bit, then
        # the standard 24-bit OUI) in case multiple lengths could match.
        for length in (9, 7, 6):
            prefix = hex_mac[:length]
            if prefix in self._prefixes:
                return self._prefixes[prefix]
        return None
