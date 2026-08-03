# Database Schema

SQLite database (`aiosqlite`), WAL mode with tuned pragmas (see [DEPLOYMENT_RASPBERRY_PI.md](./DEPLOYMENT_RASPBERRY_PI.md#database-sqlite)). Path set via `DB_PATH` (see [ENV_FILE_REQUIREMENTS.md](./ENV_FILE_REQUIREMENTS.md)).

## Tables are defined in TWO places — update both that apply

When adding or changing a table, you may need to touch both of:

1. **`backend/services/storage/base.py`'s `_create_tables()`** — idempotent `CREATE TABLE IF NOT EXISTS`, the single source of truth for fresh databases. Covers every table: `devices`, `flows`, `filter_presets`, `alert_rules`, `triggered_alerts`, `device_baselines`, `threats`, `users`, `api_keys`, plus their indexes. `users`/`api_keys` used to be created separately by `auth_service.py`'s own connection — consolidated here since `state.storage.initialize()` always runs before `AuthService` connects (see main.py's lifespan), so they're guaranteed to exist by the time auth needs them.
2. **`backend/utils/migrations.py`'s `MIGRATIONS` dict + `run_migrations()`** — versioned migrations that upgrade an *existing* deployed database. This is what actually runs against the Pi's live DB, not `_create_tables()`. **Gotcha**: `run_migrations()` uses `db.executescript()` (not `db.execute()`) for the generic case, because a migration's `up` SQL may contain more than one `;`-separated statement — `execute()` only runs one statement at a time in sqlite3/aiosqlite.

If you add a table or column, decide: does it need to survive on the Pi's already-deployed, non-empty database? If yes, add a migration (#2). Always also add it to `_create_tables()` (#1) so fresh installs get it without waiting for migrations to run.

## Current schema version: 9

| Version | Description |
|---|---|
| 1 | Initial schema (created directly in `_create_tables()`, no migration SQL) |
| 2 | Add `notes` column to `devices` |
| 3 | Add `tags` column to `devices` |
| 4 | Add `filter_presets` table |
| 5 | Add `alert_rules` + `triggered_alerts` tables |
| 6 | Add `device_baselines` table (baseline/predictive analytics feature) |
| 7 | Add deep protocol decoding columns to `flows`: `http_host`, `http_status_code`, `dns_query_name`, `dns_answers`, `tls_version` |
| 8 | Add `occurrence_count` column to `threats` (dedup) |
| 9 | Remove junk devices with unspecified/link-local IPs and their orphaned `new_device` threats |

Schema version is tracked in a `schema_version` table (`version INTEGER PRIMARY KEY`, `applied_at`, `description`), auto-created by `create_schema_version_table()`. `run_migrations()` runs on every backend startup and only applies migrations above the DB's current recorded version — safe to run repeatedly.

## Tables

### `devices`
`id` (PK), `name`, `ip`, `mac` (UNIQUE), `type`, `vendor`, `os`, `first_seen`, `last_seen`, `bytes_total`, `connections_count`, `threat_score`, `behavioral` (JSON text), `notes`, `ipv6_support`, `avg_rtt`, `connection_quality`, `applications`, `tags`.
Indexes: `name`, `ip`.

### `flows`
`id` (PK), `timestamp`, `source_ip`, `source_port`, `dest_ip`, `dest_port`, `protocol`, `bytes_in`, `bytes_out`, `packets_in`, `packets_out`, `duration`, `status`, `country`, `city`, `asn`, `domain`, `sni`, `threat_level`, `device_id` (FK → `devices.id`), `tcp_flags`, `ttl`, `connection_state`, `rtt`, `retransmissions`, `jitter`, `application`, `user_agent`, `http_method`, `url`, `dns_query_type`, `dns_response_code`, `http_host`, `http_status_code`, `dns_query_name`, `dns_answers`, `tls_version`.
Indexes: `timestamp DESC`, `device_id`, `status`, `source_ip`, `dest_ip`, `domain`, composite `(device_id, timestamp DESC)` (for device-scoped time-range queries).

### `threats`
`id` (PK), `timestamp`, `type`, `severity`, `device_id` (FK), `flow_id` (FK), `description`, `recommendation`, `dismissed`, `occurrence_count` (migration 8, dedup).

### `device_baselines`
`device_id` (PK), `{bytes_total,connections,avg_rtt,avg_jitter,retransmission_rate}_{mean,stddev}`, `sample_count`, `updated_at`. One row per device, updated hourly by `_periodic_baseline_learning`.

### `filter_presets`
`id` (PK), `user_id`, `name`, `filters` (JSON text), `created_at`. Index on `user_id`.

### `alert_rules`
`id` (PK), `user_id`, `name`, `enabled`, `metric`, `operator`, `threshold`, `values_json`, `severity`, `cooldown_minutes`, `created_at`, `updated_at`. Index on `user_id`.

### `triggered_alerts`
`id` (PK), `rule_id`, `rule_name`, `timestamp`, `severity`, `device_id`, `flow_id`, `metric`, `value`, `description`, `acknowledged`. Indexes on `timestamp DESC` and `acknowledged`.

### `users`
`id` (PK), `username` (UNIQUE), `email`, `full_name`, `hashed_password`, `role` (default `viewer`), `disabled`, `created_at`, `last_login`. A default `admin` account is auto-created on first boot with a random password (see `DEFAULT_ADMIN_PASSWORD` in [ENV_FILE_REQUIREMENTS.md](./ENV_FILE_REQUIREMENTS.md)). `auth_service.py` connects to the same db file with its own separate `aiosqlite` connection, but the table itself is created by `storage/base.py`.

### `api_keys`
`id` (PK), `key_hash` (UNIQUE), `name`, `user_id` (FK → `users.id`, `ON DELETE CASCADE`), `created_at`, `last_used`, `expires_at`, `disabled`, `permissions` (JSON array).

## Retention & maintenance

`DATA_RETENTION_DAYS` (default 30, set lower — e.g. 3 — on resource-constrained Pis) controls how far back flows/threats/triggered_alerts are kept; `cleanup_old_data()` deletes past the retention window and runs `PRAGMA wal_checkpoint(TRUNCATE)` afterward unconditionally (even when 0 rows are deleted) to reclaim WAL space. `_periodic_cleanup` runs on a timer in `main.py` — starts ~5 minutes after boot specifically so it fires even on a frequently-restarted Pi, not just after 24h uptime.

## Known incidents (context for future debugging)

Two production incidents were caused by **unbounded materialization** — loading entire tables into Python/Pydantic objects instead of aggregating in SQL:

1. `advanced_analytics.py`'s 5 stats methods called `storage.get_flows(limit=100000, ...)` and aggregated client-side in Python; fixed by adding SQL `GROUP BY` aggregate methods (`aggregate_*`) to `StorageService` — 17-40s queries dropped to 0.1-0.4s.
2. `get_threats(active_only=False)` had no `limit` at all, loading 40k+ threat rows on every `/api/stats/summary` call; fixed by defaulting `limit=200` and adding `aggregate_threat_stats()`/`aggregate_threat_counts_by_hour()`.

**Rule of thumb**: any new `get_*`/`aggregate_*` method on `StorageService` that could scan a large/unbounded row count should aggregate in SQL, not Python, and should default to a sane `limit`.
