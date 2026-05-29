import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'
import { DatabaseService } from '../database.service'
import { Cron, CronExpression } from '@nestjs/schedule'

@Injectable()
export class DevicesService {
  private readonly logger = new Logger(DevicesService.name)

  constructor(private readonly db: DatabaseService) {}

  /* =====================================================
     HELPERS CONFIG LIBELLULE
  ===================================================== */
  private getLibelluleConfig() {
    const baseUrl = (process.env.LIBELLULE_BASE_URL || '').trim()
    const email = (process.env.LIBELLULE_EMAIL || '').trim()
    const password = (process.env.LIBELLULE_PASSWORD || '').trim()
    const userApiHash = (process.env.LIBELLULE_HASH || '').trim()

    return {
      baseUrl,
      email,
      password,
      userApiHash
    }
  }

  private hasValidLibelluleConfig() {
    const { baseUrl, email, password, userApiHash } = this.getLibelluleConfig()
    return Boolean(baseUrl && email && password && userApiHash)
  }

  private logMissingLibelluleConfig() {
    const { baseUrl, email, password, userApiHash } = this.getLibelluleConfig()
    const missing: string[] = []

    if (!baseUrl) missing.push('LIBELLULE_BASE_URL')
    if (!email) missing.push('LIBELLULE_EMAIL')
    if (!password) missing.push('LIBELLULE_PASSWORD')
    if (!userApiHash) missing.push('LIBELLULE_HASH')

    this.logger.error(
      `Configuration Libellule incomplète dans .env : ${missing.join(', ')}`
    )
  }

  private normalizeLibelluleBaseUrl(baseUrl: string) {
    let normalized = (baseUrl || '').trim()

    normalized = normalized.replace(/\/+$/, '')

    if (normalized.endsWith('/api/get_devices')) {
      normalized = normalized.replace(/\/api\/get_devices$/i, '')
    }

    return normalized
  }

  /* =====================================================
     SYNC AUTOMATIQUE (Toutes les 5 minutes)
  ===================================================== */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleCron() {
    this.logger.log('CRON: Lancement de la synchronisation automatique...')

    if (!this.hasValidLibelluleConfig()) {
      this.logMissingLibelluleConfig()
      this.logger.warn(
        'CRON ignoré : synchronisation non lancée car la configuration Libellule est incomplète.'
      )
      return
    }

    await this.syncDevices()
  }

  /* =====================================================
     GET DEVICES FROM DATABASE (Dernière position connue)
  ===================================================== */
  async getAllDevices(searchTerm?: string) {
    try {
      let query = `
        SELECT v1.*
        FROM vehicules v1
        INNER JOIN (
          SELECT device_id, MAX(server_time) AS max_time
          FROM vehicules
          GROUP BY device_id
        ) v2 ON v1.device_id = v2.device_id AND v1.server_time = v2.max_time
        WHERE 1=1
      `

      const params: any[] = []

      if (searchTerm && searchTerm.trim() !== '') {
        query += ` AND (CAST(v1.device_id AS CHAR) LIKE ? OR v1.device_name LIKE ?)`
        params.push(`%${searchTerm}%`, `%${searchTerm}%`)
      }

      query += ` ORDER BY v1.server_time DESC`

      const rows = await this.db.query(query, params)
      return rows as any[]
    } catch (error: any) {
      this.logger.error('Error fetching devices', error?.message || error)
      return []
    }
  }

  /* =====================================================
     GET DEVICE INFO
  ===================================================== */
  async getDeviceInfo(deviceId: number) {
    try {
      const rows = await this.db.query(
        `SELECT *
         FROM vehicules
         WHERE device_id = ?
         ORDER BY server_time DESC
         LIMIT 1`,
        [deviceId]
      )

      const result = rows as any[]
      return result[0] || { device_id: deviceId, device_name: 'Inconnu' }
    } catch (error: any) {
      this.logger.error(
        `Error fetching device info for ID ${deviceId}`,
        error?.message || error
      )
      return { device_id: deviceId, device_name: 'Inconnu' }
    }
  }

  /* =====================================================
     STATISTIQUES D'ALERTES PAR VÉHICULE (30 derniers jours)
  ===================================================== */
  async getDeviceAlertStats(deviceId: number) {
    try {
      const rows = await this.db.query(
        `SELECT alert_type, COUNT(*) AS count
         FROM v_new_all_alerts
         WHERE device_id = ?
           AND alert_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)
         GROUP BY alert_type`,
        [deviceId]
      )

      const stats = rows as any[]

      const result = {
        total: 0,
        speed: 0,
        power: 0,
        io199: 0,
        time: 0
      }

      stats.forEach((s) => {
        const count = Number(s.count || 0)
        const type = String(s.alert_type || '').toUpperCase().trim()

        result.total += count

        if (type === 'SPEED' || type === 'SURVITESSE') {
          result.speed += count
        } else if (
          type === 'POWER' ||
          type === 'ALIMENTATION' ||
          type === 'ALIMENTATION_CASE1' ||
          type === 'ALIMENTATION_CASE2'
        ) {
          result.power += count
        } else if (
          type === 'IO199' ||
          type === 'INJECTION_DONNEES' ||
          type === 'INJECTION'
        ) {
          result.io199 += count
        } else if (
          type === 'TIME' ||
          type === 'INCOHERENCE_DATE' ||
          type === 'INCOHERENCE_TEMPS'
        ) {
          result.time += count
        }
      })

      return result
    } catch (error: any) {
      this.logger.error(
        `Error fetching alert stats for device ${deviceId}`,
        error?.message || error
      )
      return { total: 0, speed: 0, power: 0, io199: 0, time: 0 }
    }
  }

  /* =====================================================
     ÉVOLUTION DE LA VITESSE (temps réel - 24h)
  ===================================================== */
  async getDeviceSpeedEvolution(deviceId: number) {
    try {
      const rows = await this.db.query(
        `SELECT server_time, speed
         FROM vehicules
         WHERE device_id = ?
           AND server_time >= NOW() - INTERVAL 24 HOUR
           AND speed > 0
         ORDER BY server_time ASC`,
        [deviceId]
      )
      return rows
    } catch (error: any) {
      this.logger.error(
        `Error fetching speed evolution for device ${deviceId}`,
        error?.message || error
      )
      return []
    }
  }

  /* =====================================================
     ÉVOLUTION DE LA PUISSANCE (temps réel - 24h)
  ===================================================== */
  async getDevicePowerEvolution(deviceId: number) {
    try {
      const rows = await this.db.query(
        `SELECT server_time, power
         FROM vehicules
         WHERE device_id = ?
           AND server_time >= NOW() - INTERVAL 24 HOUR
           AND power IS NOT NULL
         ORDER BY server_time ASC`,
        [deviceId]
      )
      return rows
    } catch (error: any) {
      this.logger.error(
        `Error fetching power evolution for device ${deviceId}`,
        error?.message || error
      )
      return []
    }
  }

  /* =====================================================
     INCOHÉRENCES TEMPS (7 jours)
  ===================================================== */
  async getDeviceTimeInconsistency(deviceId: number) {
    try {
      const rows = await this.db.query(
        `SELECT *
         FROM v_new_incoherence_date
         WHERE device_id = ?
           AND alert_time >= NOW() - INTERVAL 7 DAY
         ORDER BY alert_time DESC`,
        [deviceId]
      )
      return rows
    } catch (error: any) {
      this.logger.error(
        `Error fetching time inconsistency for device ${deviceId}`,
        error?.message || error
      )
      return []
    }
  }

  /* =====================================================
     VITESSES EXCESSIVES (7 jours)
  ===================================================== */
  async getDeviceExcessiveSpeed(deviceId: number) {
    try {
      const rows = await this.db.query(
        `SELECT *
         FROM v_new_survitesse
         WHERE device_id = ?
           AND alert_time >= NOW() - INTERVAL 7 DAY
         ORDER BY alert_time DESC`,
        [deviceId]
      )
      return rows
    } catch (error: any) {
      this.logger.error(
        `Error fetching excessive speed for device ${deviceId}`,
        error?.message || error
      )
      return []
    }
  }

  /* =====================================================
     ALERTES IO199 (7 jours)
  ===================================================== */
  async getDeviceIO199Alerts(deviceId: number) {
    try {
      const rows = await this.db.query(
        `SELECT *
         FROM v_new_injection_donnees
         WHERE device_id = ?
           AND alert_time >= NOW() - INTERVAL 7 DAY
         ORDER BY alert_time DESC`,
        [deviceId]
      )
      return rows
    } catch (error: any) {
      this.logger.error(
        `Error fetching IO199 alerts for device ${deviceId}`,
        error?.message || error
      )
      return []
    }
  }

  /* =====================================================
     ALERTES ALIMENTATION (7 jours)
  ===================================================== */
  async getDevicePowerAlerts(deviceId: number) {
    try {
      const rows = await this.db.query(
        `SELECT *
         FROM (
           SELECT * FROM v_new_alimentation_case1
           UNION ALL
           SELECT * FROM v_new_alimentation_case2
         ) power_alerts
         WHERE device_id = ?
           AND alert_time >= NOW() - INTERVAL 7 DAY
         ORDER BY alert_time DESC`,
        [deviceId]
      )
      return rows
    } catch (error: any) {
      this.logger.error(
        `Error fetching power alerts for device ${deviceId}`,
        error?.message || error
      )
      return []
    }
  }

  /* =====================================================
     DASHBOARD COMPLET D'UN VÉHICULE
  ===================================================== */
  async getDeviceDashboard(deviceId: number) {
    try {
      const [
        device,
        speedEvolution,
        powerEvolution,
        timeInconsistency,
        excessiveSpeed,
        io199Alerts,
        powerAlerts
      ] = await Promise.all([
        this.getDeviceInfo(deviceId),
        this.getDeviceSpeedEvolution(deviceId),
        this.getDevicePowerEvolution(deviceId),
        this.getDeviceTimeInconsistency(deviceId),
        this.getDeviceExcessiveSpeed(deviceId),
        this.getDeviceIO199Alerts(deviceId),
        this.getDevicePowerAlerts(deviceId)
      ])

      const normalizedTime = (timeInconsistency as any[]).map((a) => ({
        ...a,
        type: 'time',
        server_time: a.alert_time ?? a.end_time ?? a.start_time ?? null
      }))

      const normalizedSpeed = (excessiveSpeed as any[]).map((a) => ({
        ...a,
        type: 'speed',
        server_time: a.alert_time ?? a.end_time ?? a.start_time ?? null,
        speed: a.max_speed ?? a.min_speed ?? null
      }))

      const normalizedPower = (powerAlerts as any[]).map((a) => ({
        ...a,
        type: 'power',
        server_time: a.alert_time ?? a.end_time ?? a.start_time ?? null,
        power: a.power_value ?? null
      }))

      const normalizedIo = (io199Alerts as any[]).map((a) => ({
        ...a,
        type: 'io',
        server_time: a.alert_time ?? a.end_time ?? a.start_time ?? null,
        io199: a.io199_value ?? null
      }))

      const recent = [
        ...normalizedTime,
        ...normalizedSpeed,
        ...normalizedPower,
        ...normalizedIo
      ]
        .filter((a) => a.server_time)
        .sort(
          (a, b) =>
            new Date(b.server_time).getTime() - new Date(a.server_time).getTime()
        )
        .slice(0, 20)

      return {
        success: true,
        device,
        totals: {
          totalAlerts:
            normalizedTime.length +
            normalizedSpeed.length +
            normalizedPower.length +
            normalizedIo.length,
          timeAlerts: normalizedTime.length,
          speedAlerts: normalizedSpeed.length,
          powerAlerts: normalizedPower.length,
          io199Alerts: normalizedIo.length
        },
        charts: {
          timestamps: (speedEvolution as any[]).map((r) => r.server_time),
          speeds: (speedEvolution as any[]).map((r) => Number(r.speed || 0)),
          powers: (powerEvolution as any[]).map((r) => Number(r.power || 0))
        },
        alerts: {
          recent,
          timeInconsistency: normalizedTime,
          excessiveSpeed: normalizedSpeed,
          powerAnomalies: normalizedPower,
          io199: normalizedIo
        }
      }
    } catch (error: any) {
      this.logger.error(
        `Error building dashboard for device ${deviceId}`,
        error?.message || error
      )

      return {
        success: false,
        device: { device_id: deviceId, device_name: 'Inconnu' },
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
        }
      }
    }
  }

  /* =====================================================
     SYNC DEVICES FROM LIBELLULE
  ===================================================== */
async syncDevices() {
  try {
    const { baseUrl, email, password, userApiHash } = this.getLibelluleConfig()

    if (!baseUrl || !email || !password || !userApiHash) {
      this.logMissingLibelluleConfig()

      return {
        success: false,
        error: 'Configuration Libellule incomplète dans .env',
        inserted: 0,
        updated: 0,
        skipped: 0
      }
    }

    const normalizedBaseUrl = this.normalizeLibelluleBaseUrl(baseUrl)

    this.logger.log(`BASE URL = [${normalizedBaseUrl}]`)
    this.logger.log(`EMAIL = [${email}]`)
    this.logger.log(`PASSWORD LENGTH = ${password.length}`)
    this.logger.log(`HASH LENGTH = ${userApiHash.length}`)

    // 🔥 VERSION NAVIGATEUR (CRITIQUE)
    const response = await axios.get(
      `${normalizedBaseUrl}/api/get_devices`,
      {
        params: {
          email,
          password,
          user_api_hash: userApiHash,
        },
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Accept': 'application/json, text/plain, */*',
          'Referer': 'https://libellule.sudcontractors.com/',
          'Origin': 'https://libellule.sudcontractors.com',
          'Connection': 'keep-alive'
        },
        withCredentials: true,
        timeout: 30000,
        validateStatus: () => true
      }
    )

    this.logger.log(`HTTP STATUS = ${response.status}`)
    this.logger.log(`HTTP DATA = ${JSON.stringify(response.data)}`)

    if (response.status !== 200 || response?.data?.status === 0) {
      return {
        success: false,
        error:
          response?.data?.message ||
          `Libellule a retourné le statut ${response.status}`,
        inserted: 0,
        updated: 0,
        skipped: 0
      }
    }

    const raw = response.data
    let devices: any[] = []

    // 🔍 NORMALISATION DATA
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (item?.items) devices.push(...item.items)
        else if (item?.id) devices.push(item)
      }
    } else if (raw?.items) {
      devices = raw.items
    } else if (raw?.data) {
      devices = raw.data
    } else if (raw?.id) {
      devices = [raw]
    }

    this.logger.log(`Devices extracted: ${devices.length}`)

    if (!devices.length) {
      return {
        success: false,
        error: 'Aucun device reçu depuis Libellule',
        inserted: 0,
        updated: 0,
        skipped: 0
      }
    }

    let inserted = 0
    let updated = 0
    let skipped = 0

    for (const device of devices) {
      try {
        if (!device?.id) {
          skipped++
          continue
        }

        const traccar = device?.device_data?.traccar ?? {}

        const device_id = Number(device.id)
        const device_name = device.name?.toString() || ''

        const latitude = Number(device?.lat ?? traccar?.lat ?? 0)
        const longitude = Number(device?.lng ?? traccar?.lng ?? 0)
        const speed = Number(traccar?.speed ?? 0)
        const power = traccar?.power != null ? Number(traccar.power) : null

        const device_time = traccar?.device_time
          ? new Date(traccar.device_time)
          : new Date()

        const server_time = traccar?.server_time
          ? new Date(traccar.server_time)
          : new Date()

        let io199: number | null = null

        if (Array.isArray(device?.sensors)) {
          const sensor = device.sensors.find((s: any) => s.tag_name === 'io199')
          if (sensor?.val != null) {
            io199 = Number(sensor.val)
          }
        }

        const result: any = await this.db.query(
          `INSERT INTO vehicules
           (device_id, device_name, latitude, longitude, speed, power, device_time, server_time, io199)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             device_name = VALUES(device_name),
             latitude = VALUES(latitude),
             longitude = VALUES(longitude),
             speed = VALUES(speed),
             power = VALUES(power),
             device_time = VALUES(device_time),
             server_time = VALUES(server_time),
             io199 = VALUES(io199)`,
          [
            device_id,
            device_name,
            latitude,
            longitude,
            speed,
            power,
            device_time,
            server_time,
            io199
          ]
        )

        if (result?.affectedRows === 1) inserted++
        else if (result?.affectedRows === 2) updated++
        else skipped++
      } catch (err: any) {
        this.logger.error(`SQL ERROR device ${device?.id}`, err?.message || err)
        skipped++
      }
    }

    this.logger.log(`SYNC OK → inserted:${inserted} updated:${updated} skipped:${skipped}`)

    return {
      success: true,
      inserted,
      updated,
      skipped
    }
  } catch (error: any) {
    this.logger.error('Global sync error')
    this.logger.error(`ERROR MESSAGE = ${error?.message || error}`)

    return {
      success: false,
      error: error?.message || 'Échec de connexion',
      inserted: 0,
      updated: 0,
      skipped: 0
    }
  }
}
}