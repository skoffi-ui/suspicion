import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { DevicesModule } from './devices/devices.module';
import { ReportsModule } from './reports/reports.module';

import { DashboardController } from './dashboard/dashboard.controller';
import { DashboardService } from './dashboard/dashboard.service';

import { DatabaseService } from './database.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      expandVariables: true,
      cache: true,
    }),
    ScheduleModule.forRoot(),
    DevicesModule,
    ReportsModule,
  ],
  controllers: [
    AppController,
    DashboardController,
  ],
  providers: [
    AppService,
    DashboardService,
    DatabaseService,
  ],
})
export class AppModule {}