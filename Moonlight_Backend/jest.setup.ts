import { afterAll } from '@jest/globals';
import pool from './src/shared/config/database.js';
import { closeCache } from './src/shared/cache/redis.js'

afterAll(async () => {
  await pool.end();
  await closeCache();
});
