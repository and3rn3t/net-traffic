#!/bin/bash
# GeoIP Database Update Script
# Downloads the free DB-IP City Lite mmdb (no account/license key required)
# and points GEOIP_DB_PATH at it. DB-IP publishes a new "Lite" build monthly;
# re-run this script (e.g. via a monthly cron job) to stay current.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/../backend"
DATA_DIR="$BACKEND_DIR/data"
DEST_FILE="$DATA_DIR/GeoLite2-City.mmdb"

mkdir -p "$DATA_DIR"

# DB-IP filenames are dated YYYY-MM; the current month's file usually isn't
# published until a few days in, so fall back to last month on a 404.
THIS_MONTH=$(date +%Y-%m)
LAST_MONTH=$(date -d "last month" +%Y-%m 2>/dev/null || date -v-1m +%Y-%m)

download() {
    local month="$1"
    local url="https://download.db-ip.com/free/dbip-city-lite-${month}.mmdb.gz"
    echo "Attempting download for ${month}: ${url}"
    curl -fsSL "$url" -o "${DEST_FILE}.gz"
}

if ! download "$THIS_MONTH"; then
    echo "Current month not available yet, falling back to ${LAST_MONTH}"
    download "$LAST_MONTH"
fi

gunzip -f "${DEST_FILE}.gz"
echo "GeoIP database installed: $DEST_FILE"
echo "Set GEOIP_DB_PATH=$DEST_FILE in backend/.env (restart the service to pick it up)"
