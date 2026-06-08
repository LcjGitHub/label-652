import { db, dbReady, runQuery } from '../database.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import config from '../../config.js';

const JWT_SECRET = config.jwt?.secret || 'test-secret-key-for-integration-testing';

const tablesToClean = [
  'order_items', 'orders', 'carts', 'user_coupons', 'coupons',
  'promotion_products', 'promotions', 'product_skus', 'product_spec_values',
  'product_specs', 'products', 'users'
];

beforeAll(async () => {
  await dbReady;
  await cleanAllTables();
});

afterAll(async () => {
  try {
    await db.close();
  } catch (e) {
    // ignore close errors
  }
});

async function cleanAllTables() {
  for (const table of tablesToClean) {
    try {
      await runQuery(`DELETE FROM ${table}`);
    } catch (e) {
      // ignore errors (table may not exist yet)
    }
  }
  try {
    await runQuery("DELETE FROM sqlite_sequence");
  } catch (e) {}
}

export { JWT_SECRET, cleanAllTables };
