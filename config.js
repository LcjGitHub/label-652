import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let fileConfig = {};
const configPath = path.join(__dirname, 'config.json');
if (existsSync(configPath)) {
  try {
    fileConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
  } catch (e) {
    console.warn('读取 config.json 失败，使用环境变量配置');
  }
}

const getEnv = (key, defaultValue = '') => {
  return process.env[key] || defaultValue;
};

const getEnvInt = (key, defaultValue = 0) => {
  const val = process.env[key];
  return val ? parseInt(val, 10) : defaultValue;
};

const getEnvBool = (key, defaultValue = false) => {
  const val = process.env[key];
  if (val === undefined) return defaultValue;
  return val === 'true' || val === '1' || val === 'yes';
};

const config = {
  backend: {
    port: getEnvInt('BACKEND_PORT', fileConfig.backend?.port || 3005),
    host: getEnv('BACKEND_HOST', fileConfig.backend?.host || '0.0.0.0')
  },
  frontend: {
    port: getEnvInt('FRONTEND_PORT', fileConfig.frontend?.port || 5185),
    host: getEnv('FRONTEND_HOST', fileConfig.frontend?.host || '0.0.0.0'),
    apiBaseUrl: getEnv('VITE_API_BASE_URL', '/api')
  },
  jwt: {
    secret: getEnv('JWT_SECRET', fileConfig.jwt?.secret || 'your-secret-key-change-in-production-please'),
    expiresIn: getEnv('JWT_EXPIRES_IN', '7d')
  },
  database: {
    type: getEnv('DB_TYPE', 'sqlite'),
    sqlite: {
      path: getEnv('DB_SQLITE_PATH', path.join(__dirname, 'backend', 'products.db'))
    },
    postgres: {
      host: getEnv('DB_HOST', 'postgres'),
      port: getEnvInt('DB_PORT', 5432),
      user: getEnv('DB_USER', 'postgres'),
      password: getEnv('DB_PASSWORD', 'postgres'),
      database: getEnv('DB_NAME', 'product_management')
    }
  },
  redis: {
    enabled: getEnvBool('USE_REDIS', false),
    host: getEnv('REDIS_HOST', 'redis'),
    port: getEnvInt('REDIS_PORT', 6379),
    password: getEnv('REDIS_PASSWORD', ''),
    db: getEnvInt('REDIS_DB', 0)
  },
  cors: {
    origin: getEnv('CORS_ORIGIN', '*')
  }
};

export default config;
