import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';

@Injectable()
export class AlertsService {

  constructor(private db: DatabaseService) {}

  /* =====================================================
     LIST ALL ALERTS (With Filtering)
  ===================================================== */

  async getAllAlerts(filters: { device?: string, type?: string, date?: string }) {
    
    let query = `SELECT * FROM v_new_all_alerts WHERE 1=1`;
    const params: any[] = [];

    if (filters.device) {
      query += ` AND device_name LIKE ?`;
      params.push(`%${filters.device}%`);
    }

    if (filters.type) {
      query += ` AND alert_type = ?`;
      params.push(filters.type);
    }

    if (filters.date) {
      query += ` AND DATE(alert_time) = ?`;
      params.push(filters.date);
    }

    query += ` ORDER BY alert_time DESC LIMIT 100`;

    return this.db.query(query, params);
  }

  /* =====================================================
     SUMMARY STATS FOR ALERTS PAGE
  ===================================================== */

  async getAlertStats() {
    return this.db.query(`
      SELECT alert_type, COUNT(*) as count 
      FROM v_new_all_alerts 
      WHERE alert_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY alert_type
    `);
  }

}
