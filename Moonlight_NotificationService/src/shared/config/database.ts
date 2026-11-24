import mysql from 'mysql2/promise';
import 'dotenv/config';

const pool = mysql.createPool({
  host: process.env.NOTIFICATIONS_DB_HOST || 'localhost',
  user: process.env.NOTIFICATIONS_DB_USER || 'root',
  password: process.env.NOTIFICATIONS_DB_PASSWORD || '',
  database: process.env.NOTIFICATIONS_DB_DATABASE_NAME || 'notifications_db',
  waitForConnections: true,
  connectionLimit: 10,
  multipleStatements: true,
});

export default pool;
