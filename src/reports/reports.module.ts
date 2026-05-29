import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { DatabaseService } from '../database.service';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, DatabaseService],
})
export class ReportsModule {}