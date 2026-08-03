"""Baseline repository: learned per-device behavioral baselines (predictive anomaly detection)."""
from typing import List, Optional

from models.baseline import DeviceBaseline
from services.storage.base import Repository


class BaselineRepository(Repository):
    async def upsert_device_baseline(self, baseline: DeviceBaseline):
        """Insert or update a device's learned behavioral baseline"""
        await self.base._execute_with_retry("""
            INSERT OR REPLACE INTO device_baselines
            (device_id, bytes_total_mean, bytes_total_stddev, connections_mean,
             connections_stddev, avg_rtt_mean, avg_rtt_stddev, avg_jitter_mean,
             avg_jitter_stddev, retransmission_rate_mean, retransmission_rate_stddev,
             sample_count, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            baseline.deviceId, baseline.bytesTotalMean, baseline.bytesTotalStdDev,
            baseline.connectionsMean, baseline.connectionsStdDev, baseline.avgRttMean,
            baseline.avgRttStdDev, baseline.avgJitterMean, baseline.avgJitterStdDev,
            baseline.retransmissionRateMean, baseline.retransmissionRateStdDev,
            baseline.sampleCount, baseline.updatedAt
        ))
        await self.base._ensure_connection()
        await self.base.db.commit()

    async def get_device_baseline(self, device_id: str) -> Optional[DeviceBaseline]:
        """Get a single device's learned baseline"""
        query = "SELECT * FROM device_baselines WHERE device_id = ?"
        if self.base.pool:
            async with self.base.pool.acquire() as conn:
                async with conn.execute(query, (device_id,)) as cursor:
                    row = await cursor.fetchone()
                    return self._row_to_device_baseline(row) if row else None
        else:
            await self.base._ensure_connection()
            async with self.base.db.execute(query, (device_id,)) as cursor:
                row = await cursor.fetchone()
                return self._row_to_device_baseline(row) if row else None

    async def get_all_device_baselines(self) -> List[DeviceBaseline]:
        """Get all learned device baselines"""
        query = "SELECT * FROM device_baselines"
        if self.base.pool:
            async with self.base.pool.acquire() as conn:
                async with conn.execute(query) as cursor:
                    rows = await cursor.fetchall()
                    return [self._row_to_device_baseline(row) for row in rows]
        else:
            await self.base._ensure_connection()
            async with self.base.db.execute(query) as cursor:
                rows = await cursor.fetchall()
                return [self._row_to_device_baseline(row) for row in rows]

    def _row_to_device_baseline(self, row) -> DeviceBaseline:
        """Convert database row to DeviceBaseline model"""
        return DeviceBaseline(
            deviceId=row["device_id"],
            bytesTotalMean=row["bytes_total_mean"],
            bytesTotalStdDev=row["bytes_total_stddev"],
            connectionsMean=row["connections_mean"],
            connectionsStdDev=row["connections_stddev"],
            avgRttMean=row["avg_rtt_mean"],
            avgRttStdDev=row["avg_rtt_stddev"],
            avgJitterMean=row["avg_jitter_mean"],
            avgJitterStdDev=row["avg_jitter_stddev"],
            retransmissionRateMean=row["retransmission_rate_mean"],
            retransmissionRateStdDev=row["retransmission_rate_stddev"],
            sampleCount=row["sample_count"],
            updatedAt=row["updated_at"],
        )
