import { Controller, Get, Query, Render } from '@nestjs/common';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  @Render('reports')
  async index(
    @Query('days') days: string = '7',
    @Query('type') type: string = 'all',
    @Query('device') device?: string,
  ) {
    const parsedDays = Number(days) > 0 ? Number(days) : 7;

    const data = await this.reportsService.getReportsDashboard(
      parsedDays,
      type,
      device,
    );

    return {
      title: 'Rapports',
      days: parsedDays,
      type,
      device: device ?? '',
      stats: data.stats,
      sections: data.sections,
      generatedAt: new Date().toLocaleString('fr-FR'),
      isReportMode: true,
    };
  }

  @Get('data')
  async getData(
    @Query('days') days: string = '7',
    @Query('type') type: string = 'all',
    @Query('device') device?: string,
  ) {
    const parsedDays = Number(days) > 0 ? Number(days) : 7;

    return this.reportsService.getReportsDashboard(
      parsedDays,
      type,
      device,
    );
  }
}