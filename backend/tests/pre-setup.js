import path from 'path';

const __dirname = path.resolve('tests');

process.env.NODE_ENV = 'test';
process.env.DB_SQLITE_PATH = path.join(__dirname, 'integration-test.db');
process.env.JWT_SECRET = 'test-secret-key-for-integration-testing';
process.env.USE_REDIS = 'false';
