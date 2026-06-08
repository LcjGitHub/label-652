import { runQuery, getQuery, allQuery } from '../database.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import config from '../../config.js';

const JWT_SECRET = config.jwt?.secret || 'test-secret-key-for-integration-testing';

async function createTestUser(username = 'testuser', email = 'test@example.com', password = 'test123') {
  const hashedPassword = await bcrypt.hash(password, 10);
  const result = await runQuery(
    'INSERT INTO users (username, email, password, avatar) VALUES (?, ?, ?, ?)',
    [username, email, hashedPassword, `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`]
  );
  const userId = result.lastID;
  return {
    id: userId,
    username,
    email,
    password
  };
}

function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '1h' });
}

async function createTestProduct(data = {}) {
  const product = {
    name: data.name || '测试商品',
    description: data.description || '这是一个测试商品',
    price: data.price || 99.99,
    category: data.category || '电子产品',
    stock: data.stock ?? 100,
    image: data.image || '/products/test.svg',
    has_multi_spec: data.has_multi_spec ?? 0
  };
  const result = await runQuery(
    'INSERT INTO products (name, description, price, category, stock, image, has_multi_spec) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [product.name, product.description, product.price, product.category, product.stock, product.image, product.has_multi_spec]
  );
  return { ...product, id: result.lastID };
}

async function createTestSku(productId, data = {}) {
  const sku = {
    sku_code: data.sku_code || `SKU-${productId}-001`,
    price: data.price || 109.99,
    stock: data.stock ?? 50,
    spec_text: data.spec_text || '颜色:红色;尺码:M'
  };
  const result = await runQuery(
    'INSERT INTO product_skus (product_id, sku_code, price, stock, spec_text) VALUES (?, ?, ?, ?, ?)',
    [productId, sku.sku_code, sku.price, sku.stock, sku.spec_text]
  );
  return { ...sku, id: result.lastID, product_id: productId };
}

async function addToCart(userId, productId, quantity = 1, skuId = null, skuName = null) {
  const result = await runQuery(
    'INSERT INTO carts (user_id, product_id, sku_id, sku_name, quantity) VALUES (?, ?, ?, ?, ?)',
    [userId, productId, skuId, skuName, quantity]
  );
  return result.lastID;
}

async function clearCart(userId) {
  await runQuery('DELETE FROM carts WHERE user_id = ?', [userId]);
}

async function createTestPromotion(data = {}) {
  const now = new Date();
  const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const promo = {
    name: data.name || '测试促销',
    type: data.type || 'discount',
    description: data.description || '测试促销描述',
    start_time: data.start_time || now.toISOString(),
    end_time: data.end_time || future.toISOString(),
    status: data.status ?? 1,
    rules: data.rules || JSON.stringify({ discount: 0.8 })
  };
  const result = await runQuery(
    'INSERT INTO promotions (name, type, description, start_time, end_time, status, rules) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [promo.name, promo.type, promo.description, promo.start_time, promo.end_time, promo.status, promo.rules]
  );
  return { ...promo, id: result.lastID };
}

async function addProductToPromotion(promotionId, productId) {
  await runQuery(
    'INSERT INTO promotion_products (promotion_id, product_id) VALUES (?, ?)',
    [promotionId, productId]
  );
}

async function createTestCoupon(data = {}) {
  const now = new Date();
  const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const coupon = {
    name: data.name || '测试优惠券',
    type: data.type || 'fixed',
    value: data.value ?? 50,
    min_amount: data.min_amount ?? 200,
    total_count: data.total_count ?? 100,
    used_count: 0,
    start_time: data.start_time || now.toISOString(),
    end_time: data.end_time || future.toISOString(),
    status: data.status ?? 1,
    description: data.description || '测试优惠券描述',
    per_user_limit: data.per_user_limit ?? 1,
    product_id: data.product_id ?? null,
    category: data.category ?? null
  };
  const result = await runQuery(
    `INSERT INTO coupons (name, type, value, min_amount, total_count, used_count, start_time, end_time, status, description, per_user_limit, product_id, category) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [coupon.name, coupon.type, coupon.value, coupon.min_amount, coupon.total_count, coupon.used_count, coupon.start_time, coupon.end_time, coupon.status, coupon.description, coupon.per_user_limit, coupon.product_id, coupon.category]
  );
  return { ...coupon, id: result.lastID };
}

async function giveCouponToUser(userId, couponId) {
  const result = await runQuery(
    "INSERT INTO user_coupons (user_id, coupon_id, status, received_at) VALUES (?, ?, 'unused', CURRENT_TIMESTAMP)",
    [userId, couponId]
  );
  return result.lastID;
}

async function getProductStock(productId, skuId = null) {
  if (skuId) {
    const result = await getQuery(
      'SELECT stock FROM product_skus WHERE id = ? AND product_id = ?',
      [skuId, productId]
    );
    return result ? result.stock : 0;
  }
  const result = await getQuery('SELECT stock FROM products WHERE id = ?', [productId]);
  return result ? result.stock : 0;
}

async function getUserCouponStatus(userCouponId) {
  const result = await getQuery(
    'SELECT status, used_at, used_order_id FROM user_coupons WHERE id = ?',
    [userCouponId]
  );
  return result || null;
}

async function getCouponUsedCount(couponId) {
  const result = await getQuery('SELECT used_count FROM coupons WHERE id = ?', [couponId]);
  return result ? result.used_count : 0;
}

export {
  createTestUser,
  generateToken,
  createTestProduct,
  createTestSku,
  addToCart,
  clearCart,
  createTestPromotion,
  addProductToPromotion,
  createTestCoupon,
  giveCouponToUser,
  getProductStock,
  getUserCouponStatus,
  getCouponUsedCount,
  JWT_SECRET
};
