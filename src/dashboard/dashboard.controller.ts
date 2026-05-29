import { Controller, Get, Query, Render } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @Render('dashboard')
  index() {
    return {};
  }

  @Get('alerts')
  async getAlerts(@Query('days') days?: string) {
    const parsedDays = Number(days || 1);
    return this.dashboardService.getDashboardAlerts(parsedDays);
  }
}
