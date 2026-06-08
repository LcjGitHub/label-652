const path = require('path');
const fs = require('fs');

const testDbPath = path.resolve('tests', 'unit', 'unit-test.db');
process.env.DB_SQLITE_PATH = testDbPath;
process.env.JWT_SECRET = 'test-secret-key';
process.env.USE_REDIS = 'false';

if (fs.existsSync(testDbPath)) {
  try { fs.unlinkSync(testDbPath); } catch(e) {}
}

const mockDb = {
  execute: () => Promise.resolve({ rows: [], rowsAffected: 0, lastInsertRowid: null }),
  close: () => {}
};

const mockCreateClient = jest.fn(() => mockDb);

jest.mock('@libsql/client/node', () => ({
  createClient: mockCreateClient
}));

module.exports = { mockDb, mockCreateClient };
