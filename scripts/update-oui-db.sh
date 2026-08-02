#!/bin/bash
# OUI Vendor Database Update Script
# Downloads the Wireshark "manuf" MAC-vendor database (free, no account/license
# key required) so device vendors (Apple, Amazon, Ubiquiti, etc.) can be
# resolved offline. Wireshark republishes it weekly; re-run this script
# (e.g. via a monthly cron job) to stay current.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/../backend"
DATA_DIR="$BACKEND_DIR/data"
DEST_FILE="$DATA_DIR/manuf"

mkdir -p "$DATA_DIR"

curl -fsSL "https://www.wireshark.org/download/automated/data/manuf" -o "$DEST_FILE"

echo "OUI vendor database installed: $DEST_FILE"
echo "Restart the backend service to pick it up (OUI_DB_PATH defaults to this location)."
