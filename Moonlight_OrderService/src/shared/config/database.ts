import mysql from 'mysql2/promise';
import 'dotenv/config'

const pool = mysql.createPool({
  host: process.env.ORDERS_DB_HOST || 'localhost',
  user: process.env.ORDERS_DB_USER || 'root',
  password: process.env.ORDERS_DB_PASSWORD || '',
  database: process.env.ORDERS_DB_DATABASE_NAME || 'orders_db',
  waitForConnections: true,
  connectionLimit: 10,
  multipleStatements: true,
});

export default pool;
