import { afterAll } from '@jest/globals';
import pool from './src/shared/config/database.js';

afterAll(async () => {
  await pool.end();
});
