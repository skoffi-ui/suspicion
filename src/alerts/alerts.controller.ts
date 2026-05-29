import { Controller, Get, Query, Render, Res } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import type { Response } from 'express';
import { Parser } from 'json2csv';

@Controller('alerts')
export class AlertsController {

  constructor(private readonly alertsService: AlertsService) {}

  /* =====================================================
     PAGE ALERTS (Render EJS)
  ===================================================== */

  @Get()
  @Render('alerts')
  async alertsPage(
    @Query('device') device?: string,
    @Query('type') type?: string,
    @Query('date') date?: string
  ) {
    
    const alerts = await this.alertsService.getAllAlerts({ device, type, date });
    const stats = await this.alertsService.getAlertStats();

    return { 
      alerts, 
      stats,
      filters: { device, type, date }
    };
  }

  /* =====================================================
     EXPORT CSV
  ===================================================== */

  @Get('export')
  async exportCsv(
    @Res() res: Response,
    @Query('device') device?: string,
    @Query('type') type?: string,
    @Query('date') date?: string
  ) {
    
    const alerts = await this.alertsService.getAllAlerts({ device, type, date });

    // Transformer les données pour le CSV
    const data = alerts.map((a: any) => ({
      'Date & Heure': new Date(a.alert_time).toLocaleString('fr-FR'),
      'Véhicule': a.device_name,
      'Type': a.alert_type,
      'Observation': a.observation,
      'Latitude': a.latitude,
      'Longitude': a.longitude
    }));

    const json2csvParser = new Parser();
    const csv = json2csvParser.parse(data);

    const fileName = `export_alertes_${new Date().toISOString().split('T')[0]}.csv`;

    res.header('Content-Type', 'text/csv');
    res.attachment(fileName);
    return res.send(csv);
  }

  /* =====================================================
     API DATA ALERTS (JSON)
  ===================================================== */

  @Get('data')
  async getAlertsData(
    @Query('device') device?: string,
    @Query('type') type?: string,
    @Query('date') date?: string
  ) {
    return this.alertsService.getAllAlerts({ device, type, date });
  }

}
