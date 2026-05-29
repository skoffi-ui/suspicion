import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Render,
  Logger,
  Param,
  Query
} from '@nestjs/common'

import { DevicesService } from './devices.service'

@Controller('devices')
export class DevicesController {
  private readonly logger = new Logger(DevicesController.name)

  constructor(private readonly devicesService: DevicesService) {}

  @Get('sync')
  async syncDevices() {
    try {
      const result = await this.devicesService.syncDevices()

      if (!result.success) {
        this.logger.warn(
          `Sync non exécutée ou incomplète: ${result.error || 'raison inconnue'}`
        )

        return {
          success: false,
          message: result.error || 'Synchronisation impossible',
          inserted: result.inserted ?? 0,
          updated: result.updated ?? 0,
          skipped: result.skipped ?? 0
        }
      }

      return {
        success: true,
        message: 'Devices synchronized successfully',
        inserted: result.inserted ?? 0,
        updated: result.updated ?? 0,
        skipped: result.skipped ?? 0
      }
    } catch (error: any) {
      this.logger.error('Sync error', error?.message || error)

      return {
        success: false,
        message: error?.message || 'Sync failed',
        inserted: 0,
        updated: 0,
        skipped: 0
      }
    }
  }

  @Get('api')
  async getDevicesAPI(@Query('search') search?: string) {
    try {
      const devices = await this.devicesService.getAllDevices(search)

      return {
        success: true,
        total: Array.isArray(devices) ? devices.length : 0,
        devices: Array.isArray(devices) ? devices : []
      }
    } catch (error: any) {
      this.logger.error('API devices error', error?.message || error)

      return {
        success: false,
        total: 0,
        devices: [],
        message: 'Unable to fetch devices'
      }
    }
  }

  @Get('api/:deviceId/dashboard')
  async getDeviceDashboardData(@Param('deviceId') deviceId: string) {
    try {
      const deviceIdNum = parseInt(deviceId, 10)

      if (isNaN(deviceIdNum)) {
        throw new HttpException('Invalid device ID', HttpStatus.BAD_REQUEST)
      }

      const dashboard = await this.devicesService.getDeviceDashboard(deviceIdNum)

      if (!dashboard?.success) {
        return {
          success: false,
          device: { device_id: deviceIdNum, device_name: 'Inconnu' },
          totals: {
            totalAlerts: 0,
            timeAlerts: 0,
            speedAlerts: 0,
            powerAlerts: 0,
            io199Alerts: 0
          },
          charts: {
            timestamps: [],
            speeds: [],
            powers: []
          },
          alerts: {
            recent: [],
            timeInconsistency: [],
            excessiveSpeed: [],
            powerAnomalies: [],
            io199: []
          },
          message: 'Unable to load device dashboard data'
        }
      }

      return dashboard
    } catch (error: any) {
      this.logger.error(
        `Error loading dashboard data for device ${deviceId}`,
        error?.message || error
      )

      if (error instanceof HttpException) {
        throw error
      }

      return {
        success: false,
        device: { device_id: Number(deviceId) || 0, device_name: 'Inconnu' },
        totals: {
          totalAlerts: 0,
          timeAlerts: 0,
          speedAlerts: 0,
          powerAlerts: 0,
          io199Alerts: 0
        },
        charts: {
          timestamps: [],
          speeds: [],
          powers: []
        },
        alerts: {
          recent: [],
          timeInconsistency: [],
          excessiveSpeed: [],
          powerAnomalies: [],
          io199: []
        },
        message: 'Unable to load device dashboard data'
      }
    }
  }

  @Get()
  @Render('devices')
  async listDevices(@Query('search') search?: string) {
    try {
      const devices = await this.devicesService.getAllDevices(search)

      return {
        title: 'Devices',
        devices: Array.isArray(devices) ? devices : [],
        searchTerm: search || ''
      }
    } catch (error: any) {
      this.logger.error('Error loading devices page', error?.message || error)

      return {
        title: 'Devices',
        devices: [],
        searchTerm: search || ''
      }
    }
  }

  @Get(':deviceId')
  @Render('device-details')
  async getDeviceDetails(@Param('deviceId') deviceId: string) {
    try {
      const deviceIdNum = parseInt(deviceId, 10)

      if (isNaN(deviceIdNum)) {
        throw new HttpException('Invalid device ID', HttpStatus.BAD_REQUEST)
      }

      const dashboard = await this.devicesService.getDeviceDashboard(deviceIdNum)

      if (!dashboard?.device || !dashboard.device.device_id) {
        throw new HttpException('Device not found', HttpStatus.NOT_FOUND)
      }

      return {
        title: `Détails - ${dashboard.device.device_name || dashboard.device.device_id}`,
        device: dashboard.device,
        stats: {
          total: dashboard.totals?.totalAlerts || 0,
          speed: dashboard.totals?.speedAlerts || 0,
          power: dashboard.totals?.powerAlerts || 0,
          io199: dashboard.totals?.io199Alerts || 0,
          time: dashboard.totals?.timeAlerts || 0
        },
        speedEvolution: Array.isArray(dashboard.charts?.timestamps)
          ? dashboard.charts.timestamps.map((t: any, i: number) => ({
              server_time: t,
              speed: dashboard.charts?.speeds?.[i] ?? 0
            }))
          : [],
        powerEvolution: Array.isArray(dashboard.charts?.timestamps)
          ? dashboard.charts.timestamps.map((t: any, i: number) => ({
              server_time: t,
              power: dashboard.charts?.powers?.[i] ?? 0
            }))
          : [],
        timeInconsistency: dashboard.alerts?.timeInconsistency || [],
        excessiveSpeed: dashboard.alerts?.excessiveSpeed || [],
        io199Alerts: dashboard.alerts?.io199 || [],
        powerAlerts: dashboard.alerts?.powerAnomalies || []
      }
    } catch (error: any) {
      this.logger.error(
        `Error loading device details for ID ${deviceId}`,
        error?.message || error
      )

      if (error instanceof HttpException) {
        throw error
      }

      throw new HttpException(
        'Unable to load device details',
        HttpStatus.INTERNAL_SERVER_ERROR
      )
    }
  }

  @Get('health')
  health() {
    return {
      status: 'OK',
      service: 'Devices Service',
      timestamp: new Date()
    }
  }
}