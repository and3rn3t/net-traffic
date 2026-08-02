#!/bin/bash
# GeoIP Database Update Script
# Prefers MaxMind GeoLite2-City (more accurate) if MAXMIND_LICENSE_KEY is set
# in the environment or in backend/.env; otherwise falls back to the free,
# no-account DB-IP City Lite database. Re-run this script (e.g. via a monthly
# cron job) to stay current - MaxMind updates GeoLite2 twice weekly, DB-IP
# publishes a new "Lite" build monthly.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/../backend"
DATA_DIR="$BACKEND_DIR/data"
DEST_FILE="$DATA_DIR/GeoLite2-City.mmdb"
ENV_FILE="$BACKEND_DIR/.env"

mkdir -p "$DATA_DIR"

# Pick up MAXMIND_LICENSE_KEY from the environment, or from backend/.env if present
if [ -z "$MAXMIND_LICENSE_KEY" ] && [ -f "$ENV_FILE" ]; then
    MAXMIND_LICENSE_KEY=$(grep -m1 '^MAXMIND_LICENSE_KEY=' "$ENV_FILE" | cut -d '=' -f2-)
fi

if [ -n "$MAXMIND_LICENSE_KEY" ]; then
    echo "MAXMIND_LICENSE_KEY found - downloading MaxMind GeoLite2-City..."
    TMP_DIR=$(mktemp -d)
    trap 'rm -rf "$TMP_DIR"' EXIT

    curl -fsSL "https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&license_key=${MAXMIND_LICENSE_KEY}&suffix=tar.gz" \
        -o "$TMP_DIR/GeoLite2-City.tar.gz"
    tar -xzf "$TMP_DIR/GeoLite2-City.tar.gz" -C "$TMP_DIR"

    MMDB_PATH=$(find "$TMP_DIR" -name "GeoLite2-City.mmdb" | head -1)
    if [ -z "$MMDB_PATH" ]; then
        echo "ERROR: GeoLite2-City.mmdb not found in the downloaded archive - check the license key" >&2
        exit 1
    fi
    mv "$MMDB_PATH" "$DEST_FILE"
    echo "MaxMind GeoLite2-City database installed: $DEST_FILE"
else
    echo "No MAXMIND_LICENSE_KEY found - falling back to the free DB-IP City Lite database."

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
    echo "DB-IP City Lite database installed: $DEST_FILE"
fi

echo "Set GEOIP_DB_PATH=$DEST_FILE in backend/.env (restart the service to pick it up)"

