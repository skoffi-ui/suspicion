import { Injectable } from '@nestjs/common';
import mysql from 'mysql2/promise';

@Injectable()
export class DatabaseService {

  private pool;

  constructor() {

    this.pool = mysql.createPool({
      host: process.env.DB_HOST || '127.0.0.1',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || 'root',
      database: process.env.DB_NAME || 'suspicion_db',
      port: Number(process.env.DB_PORT) || 8889,
      waitForConnections: true,
      connectionLimit: 10
    });

    console.log("DB CONNECTED →", process.env.DB_NAME, "PORT:", process.env.DB_PORT);

  }

  async query(sql: string, params: any[] = []) {

    const [rows] = await this.pool.query(sql, params);

    return rows;

  }

}