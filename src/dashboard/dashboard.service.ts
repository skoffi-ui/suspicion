import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';

@Injectable()
export class DashboardService {
  constructor(private readonly db: DatabaseService) {}

  async getDashboardAlerts(days = 1) {
    const safeDays = this.sanitizeDays(days);

    try {
      /* =========================
         1) TOP 10 DERNIÈRES ALERTES
         TOUJOURS les 10 dernières,
         sans filtre de période
      ========================= */
      const latestResult = await this.db.query(`
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
          COALESCE(alert_time, start_time) AS alert_time,
          observation
        FROM v_new_all_alerts
        ORDER BY COALESCE(alert_time, start_time) DESC
        LIMIT 10
      `);

      /* =========================
         2) ALERTES DE LA PÉRIODE
         utilisées pour stats + sections
      ========================= */
      const allResult = await this.db.query(
        `
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
          COALESCE(alert_time, start_time) AS alert_time,
          observation
        FROM v_new_all_alerts
        WHERE COALESCE(alert_time, start_time) >= NOW() - INTERVAL ? DAY
        ORDER BY COALESCE(alert_time, start_time) DESC
        LIMIT 500
        `,
        [safeDays],
      );

      const latest = this.normalizeResult(latestResult).map((row) =>
        this.mapAlertRow(row),
      );

      const rows = this.normalizeResult(allResult).map((row) =>
        this.mapAlertRow(row),
      );

      const grouped = this.groupByType(rows);

      /* =========================
         3) SECTIONS DASHBOARD
         - SPEED  => v_new_survitesse
         - POWER  => v_new_alimentation_case1/case2
         - IO     => v_new_injection_donnees
         - TIME   => v_new_incoherence_date
      ========================= */
      const sections = {
        survitesse: grouped.SPEED || [],
        alimentation: grouped.POWER || [],
        injection: grouped.IO || [],
        incoherenceDate: grouped.TIME || [],
      };

      const stats = {
        total_today: rows.length,
        speed: sections.survitesse.length,
        power: sections.alimentation.length,
        io: sections.injection.length,
        time: sections.incoherenceDate.length,
        other: grouped.OTHER?.length || 0,
      };

      return {
        success: true,
        filters: { days: safeDays },
        latest,
        today: grouped,
        sections,
        stats,
      };
    } catch (error) {
      console.error('DashboardService getDashboardAlerts error:', error);
      return this.emptyResponse(safeDays);
    }
  }

  // ==============================
  // HELPERS
  // ==============================

  private emptyResponse(days: number) {
    return {
      success: false,
      filters: { days },
      latest: [],
      today: {
        SPEED: [],
        POWER: [],
        IO: [],
        TIME: [],
        OTHER: [],
      },
      sections: {
        survitesse: [],
        alimentation: [],
        injection: [],
        incoherenceDate: [],
      },
      stats: {
        total_today: 0,
        speed: 0,
        power: 0,
        io: 0,
        time: 0,
        other: 0,
      },
    };
  }

  private normalizeResult(result: any): any[] {
    if (!result) return [];

    // mysql2 / promise => [rows, fields]
    if (Array.isArray(result) && Array.isArray(result[0])) {
      return result[0];
    }

    if (Array.isArray(result)) {
      return result;
    }

    return [];
  }

  private sanitizeDays(days: number): number {
    const n = Number(days);

    if (!Number.isFinite(n) || n <= 0) return 1;
    if (n > 30) return 30;

    return Math.floor(n);
  }

  private normalizeType(type: string): string {
    const t = (type || '').toUpperCase().trim();

    if (t.includes('SURVITESSE')) return 'SPEED';
    if (t.includes('ALIMENTATION') || t.includes('SURTENSION')) return 'POWER';
    if (t.includes('INJECTION') || t.includes('IO')) return 'IO';
    if (t.includes('INCOHERENCE') || t.includes('DATE') || t.includes('TIME')) {
      return 'TIME';
    }

    return 'OTHER';
  }

  private mapAlertRow(row: any) {
    const alertType = row?.alert_type || 'UNKNOWN';
    const batteryValue = this.getBatteryValue(row);

    return {
      device_id: row?.device_id ?? '',
      device_name: row?.device_name ?? '',
      alert_type: alertType,
      start_time: row?.start_time ?? null,
      end_time: row?.end_time ?? null,
      duration_min: this.toNumber(row?.duration_min),
      min_speed: this.toNullableNumber(row?.min_speed),
      max_speed: this.toNullableNumber(row?.max_speed),

      // compatibilité frontend
      battery_value: batteryValue,
      power_value: batteryValue,

      io199_value: this.toNullableNumber(row?.io199_value),

      alert_time: row?.alert_time ?? row?.start_time ?? null,
      observation: row?.observation || 'Alerte détectée',

      value: this.buildDisplayValue({
        ...row,
        battery_value: batteryValue,
      }),

      type_group: this.normalizeType(alertType),
    };
  }

  private getBatteryValue(row: any): number | null {
    const battery = this.toNullableNumber(row?.battery_value);
    if (battery !== null) return battery;

    const power = this.toNullableNumber(row?.power_value);
    if (power !== null) return power;

    return null;
  }

  private toNumber(value: any): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  private toNullableNumber(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;

    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  private buildDisplayValue(row: any): string {
    const type = (row?.alert_type || '').toUpperCase();

    if (type.includes('SURVITESSE')) {
      const speed = this.toNullableNumber(row?.max_speed);
      return speed !== null ? `${speed} km/h` : '-';
    }

    if (type.includes('ALIMENTATION') || type.includes('SURTENSION')) {
      const battery = this.getBatteryValue(row);
      return battery !== null ? `${battery} V` : '-';
    }

    if (type.includes('INJECTION') || type.includes('IO')) {
      const io = this.toNullableNumber(row?.io199_value);
      return io !== null ? `IO199=${io}` : 'IO199 actif';
    }

    if (type.includes('INCOHERENCE') || type.includes('DATE')) {
      return 'GPS > serveur + 2 min';
    }

    return '-';
  }

  private groupByType(rows: any[]) {
    const base: Record<string, any[]> = {
      SPEED: [],
      POWER: [],
      IO: [],
      TIME: [],
      OTHER: [],
    };

    return rows.reduce((acc, row) => {
      const type = this.normalizeType(row?.alert_type || 'UNKNOWN');

      if (!acc[type]) acc[type] = [];
      acc[type].push(row);

      return acc;
    }, base);
  }
}