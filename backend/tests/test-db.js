import fs from 'fs';
import path from 'path';

const TEST_DB_PATH = path.resolve('tests', 'integration-test.db');

let testDbInstance = null;

function getTestDbPath() {
  return TEST_DB_PATH;
}

function setTestDbInstance(db) {
  testDbInstance = db;
}

function getTestDb() {
  return testDbInstance;
}

function cleanupTestDbFile() {
  if (fs.existsSync(TEST_DB_PATH)) {
    try {
      fs.unlinkSync(TEST_DB_PATH);
    } catch (e) {
      console.warn('清理测试数据库文件失败:', e.message);
    }
  }
}

export {
  getTestDbPath,
  setTestDbInstance,
  getTestDb,
  cleanupTestDbFile
};
