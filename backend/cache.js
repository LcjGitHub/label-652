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
  constructor(redisClient, defaultTTL = 5 * 60) {
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
      await this.redis.setex(key, ttlSeconds, serialized);
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
    await this.redis.flushdb();
    return true;
  }
}

let cacheInstance = null;

async function createCache(options = {}) {
  if (cacheInstance) return cacheInstance;

  const defaultOptions = {
    defaultTTL: options.defaultTTL || 5 * 60 * 1000,
    useRedis: false,
    redisOptions: null
  };

  if (options.useRedis && options.redisClient) {
    cacheInstance = new RedisCache(options.redisClient, defaultOptions.defaultTTL);
  } else {
    cacheInstance = new MemoryCache(defaultOptions.defaultTTL);
  }

  return cacheInstance;
}

function getCache() {
  if (!cacheInstance) {
    cacheInstance = new MemoryCache();
  }
  return cacheInstance;
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
  CACHE_KEYS,
  MemoryCache,
  RedisCache
};
