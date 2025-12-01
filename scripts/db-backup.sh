#!/bin/bash
# Database Backup Script
# Creates a backup of the SQLite database

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/../backend"
BACKUP_DIR="$BACKEND_DIR/backups"

# Load .env to get DB_PATH
if [ -f "$BACKEND_DIR/.env" ]; then
    export $(grep -v '^#' "$BACKEND_DIR/.env" | xargs)
fi

DB_PATH="${DB_PATH:-$BACKEND_DIR/netinsight.db}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/netinsight_backup_$TIMESTAMP.db"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Check if database exists
if [ ! -f "$DB_PATH" ]; then
    echo "❌ Database not found at: $DB_PATH"
    exit 1
fi

echo "💾 Backing up database..."
echo "   Source: $DB_PATH"
echo "   Destination: $BACKUP_FILE"

# Copy database file
cp "$DB_PATH" "$BACKUP_FILE"

# Compress backup
echo "📦 Compressing backup..."
gzip "$BACKUP_FILE"
BACKUP_FILE="${BACKUP_FILE}.gz"

# Get file size
SIZE=$(du -h "$BACKUP_FILE" | cut -f1)

echo ""
echo "✅ Backup created successfully!"
echo "   File: $BACKUP_FILE"
echo "   Size: $SIZE"
echo ""

# List recent backups
echo "📋 Recent backups:"
ls -lh "$BACKUP_DIR"/*.db.gz 2>/dev/null | tail -5 | awk '{print "   " $9 " (" $5 ")"}'

# Optional: Keep only last N backups (uncomment to enable)
# KEEP_BACKUPS=10
# echo "🧹 Cleaning old backups (keeping last $KEEP_BACKUPS)..."
# ls -t "$BACKUP_DIR"/*.db.gz 2>/dev/null | tail -n +$((KEEP_BACKUPS + 1)) | xargs rm -f

