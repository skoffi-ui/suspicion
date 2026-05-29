import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';

@Injectable()
export class ReportsService {
  constructor(private readonly db: DatabaseService) {}

  async getReportsDashboard(
    days: number = 7,
    type: string = 'all',
    device?: string,
  ) {
    const safeDays = Number(days) > 0 ? Number(days) : 7;

    let whereClause = `WHERE alert_time >= NOW() - INTERVAL ? DAY`;
    const params: any[] = [safeDays];

    if (type && type !== 'all') {
      whereClause += ` AND alert_type = ?`;
      params.push(type);
    }

    if (device && device.trim() !== '') {
      whereClause += ` AND device_id = ?`;
      params.push(device.trim());
    }

    const statsSql = `
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN alert_type = 'SURVITESSE' THEN 1 ELSE 0 END) AS speed,
        SUM(CASE WHEN alert_type IN ('ALIMENTATION_CASE1', 'ALIMENTATION_CASE2') THEN 1 ELSE 0 END) AS power,
        SUM(CASE WHEN alert_type = 'INJECTION_DONNEES' THEN 1 ELSE 0 END) AS io,
        SUM(CASE WHEN alert_type = 'INCOHERENCE_DATE' THEN 1 ELSE 0 END) AS time
      FROM v_new_all_alerts
      ${whereClause}
    `;

    const rowsStats: any[] = await this.db.query(statsSql, params);

    const stats = {
      total: Number(rowsStats?.[0]?.total ?? 0),
      speed: Number(rowsStats?.[0]?.speed ?? 0),
      power: Number(rowsStats?.[0]?.power ?? 0),
      io: Number(rowsStats?.[0]?.io ?? 0),
      time: Number(rowsStats?.[0]?.time ?? 0),
    };

    const limit = device ? 50 : 100;

    const recentSql = `
      SELECT
        device_id,
        device_name,
        alert_type,
        start_time,
        end_time,
        duration_min,
        min_speed,
        max_speed,
        power_value,
        io199_value,
        alert_time
      FROM v_new_all_alerts
      ${whereClause}
      ORDER BY alert_time DESC
      LIMIT ${limit}
    `;

    const recentRows: any[] = await this.db.query(recentSql, params);

    const normalizedRows = recentRows.map((row: any) => ({
      device_id: row.device_id ?? '',
      device_name: row.device_name ?? row.device_id ?? '',
      alert_type: row.alert_type ?? '',
      start_time: row.start_time ?? null,
      end_time: row.end_time ?? null,
      duration_min: Number(row.duration_min ?? 0),
      min_speed: row.min_speed !== null && row.min_speed !== undefined ? Number(row.min_speed) : null,
      max_speed: row.max_speed !== null && row.max_speed !== undefined ? Number(row.max_speed) : null,
      power_value: row.power_value !== null && row.power_value !== undefined ? Number(row.power_value) : null,
      io199_value: row.io199_value !== null && row.io199_value !== undefined ? Number(row.io199_value) : null,
      alert_time: row.alert_time ?? null,
    }));

    const grouped = {
      survitesse: normalizedRows.filter((r) => r.alert_type === 'SURVITESSE'),
      alimentation: normalizedRows.filter((r) =>
        ['ALIMENTATION_CASE1', 'ALIMENTATION_CASE2'].includes(r.alert_type),
      ),
      injection: normalizedRows.filter((r) => r.alert_type === 'INJECTION_DONNEES'),
      incoherence: normalizedRows.filter((r) => r.alert_type === 'INCOHERENCE_DATE'),
    };

    return {
      success: true,
      stats,
      sections: grouped,
      filters: {
        days: safeDays,
        type,
        device: device ?? null,
      },
    };
  }
}