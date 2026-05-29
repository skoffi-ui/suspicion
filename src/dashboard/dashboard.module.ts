import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DatabaseService } from '../database.service';

@Module({
  controllers: [DashboardController],
  providers: [DashboardService, DatabaseService],
  exports: [DashboardService],
})
export class DashboardModule {}