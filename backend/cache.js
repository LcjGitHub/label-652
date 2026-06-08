import { createClient as createRedisClient } from 'redis';
import config from '../config.js';

class MemoryCache {
  constructor(defaultTTL = 5 * 60 * 1000) {
    this.store = new Map();
    this.defaultTTL = defaultTTL;
  }

  _isExpired(entry) {
    return entry.expireAt !== 0 && Date.now() > entry.expireAt;
  }

  async get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (this._isExpired(entry)) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key, value, ttl) {
    const expireAt = ttl ? Date.now() + ttl : (this.defaultTTL ? Date.now() + this.defaultTTL : 0);
    this.store.set(key, { value, expireAt });
    return true;
  }

  async del(key) {
    return this.store.delete(key);
  }

  async delPattern(pattern) {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    let count = 0;
    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }

  async clear() {
    this.store.clear();
    return true;
  }
}

class RedisCache {
  constructor(redisClient, defaultTTL = 5 * 60 * 1000) {
    this.redis = redisClient;
    this.defaultTTL = defaultTTL;
  }

  async get(key) {
    const data = await this.redis.get(key);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  }

  async set(key, value, ttl) {
    const ttlSeconds = Math.floor((ttl || this.defaultTTL) / 1000);
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    if (ttlSeconds > 0) {
      await this.redis.setEx(key, ttlSeconds, serialized);
    } else {
      await this.redis.set(key, serialized);
    }
    return true;
  }

  async del(key) {
    await this.redis.del(key);
    return true;
  }

  async delPattern(pattern) {
    const keys = await this.redis.keys(pattern);
    if (keys.length === 0) return 0;
    await this.redis.del(...keys);
    return keys.length;
  }

  async clear() {
    await this.redis.flushDb();
    return true;
  }
}

let cacheInstance = null;
let redisClientInstance = null;

async function initCacheFromConfig() {
  if (cacheInstance) return cacheInstance;

  const redisConfig = config.redis;

  if (redisConfig.enabled) {
    try {
      const redisOptions = {
        socket: {
          host: redisConfig.host,
          port: redisConfig.port
        }
      };
      if (redisConfig.password) {
        redisOptions.password = redisConfig.password;
      }
      if (redisConfig.db) {
        redisOptions.database = redisConfig.db;
      }

      const client = createRedisClient(redisOptions);

      client.on('error', (err) => {
        console.warn('Redis 客户端错误:', err.message);
      });

      client.on('connect', () => {
        console.log('Redis 连接成功');
      });

      await client.connect();
      redisClientInstance = client;
      cacheInstance = new RedisCache(client);
      console.log('已启用 Redis 缓存');
      return cacheInstance;
    } catch (err) {
      console.warn('Redis 连接失败，回退到内存缓存:', err.message);
      cacheInstance = new MemoryCache();
      return cacheInstance;
    }
  }

  cacheInstance = new MemoryCache();
  console.log('已启用内存缓存');
  return cacheInstance;
}

async function createCache(options = {}) {
  if (cacheInstance) return cacheInstance;

  const defaultTTL = options.defaultTTL || 5 * 60 * 1000;

  if (options.useRedis && options.redisClient) {
    cacheInstance = new RedisCache(options.redisClient, defaultTTL);
  } else {
    cacheInstance = new MemoryCache(defaultTTL);
  }

  return cacheInstance;
}

function getCache() {
  if (!cacheInstance) {
    cacheInstance = new MemoryCache();
  }
  return cacheInstance;
}

function getRedisClient() {
  return redisClientInstance;
}

const CACHE_KEYS = {
  PRODUCT_LIST: 'product:list:',
  PRODUCT_DETAIL: 'product:detail:',
  PRODUCT_SPECS: 'product:specs:',
  PRODUCT_SKUS: 'product:skus:',
  PRODUCT_STOCK: 'product:stock:',
  PRODUCT_PRICE_RANGE: 'product:price_range:',
  PRODUCT_PROMOTION: 'product:promotion:',
  ACTIVE_PROMOTIONS: 'promotions:active',
  GLOBAL_STOCK_CONFIG: 'stock:config:global',
  HOT_PRODUCTS: 'product:hot',

  TTL_PRODUCT_LIST: 60 * 1000,
  TTL_PRODUCT_DETAIL: 5 * 60 * 1000,
  TTL_PROMOTION: 2 * 60 * 1000,
  TTL_GLOBAL_CONFIG: 10 * 60 * 1000
};

export {
  createCache,
  getCache,
  initCacheFromConfig,
  getRedisClient,
  CACHE_KEYS,
  MemoryCache,
  RedisCache
};
