import Router from 'koa-router';
import {
  runQuery,
  getQuery,
  allQuery,
  getAvailableCoupons,
  getUserCoupons,
  calculateCouponDiscount,
  getCouponDisplayText
} from '../database.js';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js';

const router = new Router({ prefix: '/api/coupons' });

router.get('/available', optionalAuthMiddleware, async (ctx) => {
  const coupons = await getAvailableCoupons();

  for (const coupon of coupons) {
    coupon.display_text = getCouponDisplayText(coupon);
    coupon.remaining_count = coupon.total_count > 0 ? coupon.total_count - coupon.used_count : -1;
  }

  ctx.body = {
    success: true,
    data: coupons
  };
});

router.get('/my', authMiddleware, async (ctx) => {
  const userId = ctx.state.user.id;
  const { status } = ctx.query;

  const userCoupons = await getUserCoupons(userId, status);

  for (const uc of userCoupons) {
    uc.display_text = getCouponDisplayText(uc);
  }

  ctx.body = {
    success: true,
    data: userCoupons
  };
});

router.get('/product/:productId', optionalAuthMiddleware, async (ctx) => {
  const { productId } = ctx.params;
  const userId = ctx.state.user ? ctx.state.user.id : null;

  const product = await getQuery('SELECT id, category FROM products WHERE id = ?', [productId]);
  if (!product) {
    ctx.status = 404;
    ctx.body = { success: false, message: '商品不存在' };
    return;
  }

  const allAvailableCoupons = await getAvailableCoupons();
  const productCoupons = allAvailableCoupons.filter(coupon => {
    if (coupon.product_id && String(coupon.product_id) === String(productId)) return true;
    if (coupon.category && coupon.category === product.category) return true;
    if (!coupon.product_id && !coupon.category) return true;
    return false;
  });

  const receivedIds = new Set();
  if (userId) {
    const myCoupons = await getUserCoupons(userId);
    for (const mc of myCoupons) {
      receivedIds.add(mc.coupon_id);
    }
  }

  const result = productCoupons.map(coupon => ({
    ...coupon,
    display_text: getCouponDisplayText(coupon),
    remaining_count: coupon.total_count > 0 ? coupon.total_count - coupon.used_count : -1,
    received: receivedIds.has(coupon.id)
  }));

  ctx.body = {
    success: true,
    data: result
  };
});

router.get('/:id', async (ctx) => {
  const { id } = ctx.params;
  const coupon = await getQuery('SELECT * FROM coupons WHERE id = ?', [id]);

  if (!coupon) {
    ctx.status = 404;
    ctx.body = { success: false, message: '优惠券不存在' };
    return;
  }

  coupon.display_text = getCouponDisplayText(coupon);
  coupon.remaining_count = coupon.total_count > 0 ? coupon.total_count - coupon.used_count : -1;

  ctx.body = {
    success: true,
    data: coupon
  };
});

router.post('/', authMiddleware, async (ctx) => {
  const {
    name,
    type,
    value,
    min_amount = 0,
    total_count = 0,
    start_time,
    end_time,
    status = 1,
    description = '',
    per_user_limit = 1
  } = ctx.request.body;

  if (!name || !type || value == null || !start_time || !end_time) {
    ctx.status = 400;
    ctx.body = { success: false, message: '优惠券名称、类型、面值、开始时间和结束时间为必填项' };
    return;
  }

  const validTypes = ['fixed', 'percent'];
  if (!validTypes.includes(type)) {
    ctx.status = 400;
    ctx.body = { success: false, message: '无效的优惠券类型' };
    return;
  }

  if (type === 'percent' && (value <= 0 || value > 1)) {
    ctx.status = 400;
    ctx.body = { success: false, message: '折扣券面值必须在0到1之间' };
    return;
  }

  const result = await runQuery(`
    INSERT INTO coupons (name, type, value, min_amount, total_count, used_count, start_time, end_time, status, description, per_user_limit)
    VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
  `, [name, type, value, min_amount, total_count, start_time, end_time, status, description, per_user_limit]);

  ctx.status = 201;
  ctx.body = {
    success: true,
    message: '优惠券创建成功',
    data: { id: result.lastID }
  };
});

router.post('/:id/receive', authMiddleware, async (ctx) => {
  const userId = ctx.state.user.id;
  const { id } = ctx.params;

  const coupon = await getQuery('SELECT * FROM coupons WHERE id = ?', [id]);
  if (!coupon) {
    ctx.status = 404;
    ctx.body = { success: false, message: '优惠券不存在' };
    return;
  }

  const now = new Date().toISOString();
  if (coupon.status !== 1 || coupon.start_time > now || coupon.end_time < now) {
    ctx.status = 400;
    ctx.body = { success: false, message: '该优惠券暂不可领取' };
    return;
  }

  if (coupon.total_count > 0 && coupon.used_count >= coupon.total_count) {
    ctx.status = 400;
    ctx.body = { success: false, message: '该优惠券已领完' };
    return;
  }

  const receivedCount = await getQuery(
    'SELECT COUNT(*) as count FROM user_coupons WHERE user_id = ? AND coupon_id = ?',
    [userId, id]
  );
  if (receivedCount && receivedCount.count >= coupon.per_user_limit) {
    ctx.status = 400;
    ctx.body = { success: false, message: `您已达到该优惠券的领取上限（${coupon.per_user_limit}张）` };
    return;
  }

  const result = await runQuery(`
    INSERT INTO user_coupons (user_id, coupon_id, status, received_at)
    VALUES (?, ?, 'unused', CURRENT_TIMESTAMP)
  `, [userId, id]);

  ctx.body = {
    success: true,
    message: '优惠券领取成功',
    data: { user_coupon_id: result.lastID }
  };
});

router.post('/validate', authMiddleware, async (ctx) => {
  const userId = ctx.state.user.id;
  const { user_coupon_id, total_amount } = ctx.request.body;

  if (!user_coupon_id || total_amount == null) {
    ctx.status = 400;
    ctx.body = { success: false, message: '优惠券ID和订单金额为必填项' };
    return;
  }

  const userCoupon = await getQuery(`
    SELECT uc.*, c.name, c.type, c.value, c.min_amount, c.start_time, c.end_time, c.status as coupon_status
    FROM user_coupons uc
    INNER JOIN coupons c ON uc.coupon_id = c.id
    WHERE uc.id = ? AND uc.user_id = ?
  `, [user_coupon_id, userId]);

  if (!userCoupon) {
    ctx.status = 404;
    ctx.body = { success: false, message: '优惠券不存在' };
    return;
  }

  if (userCoupon.status === 'used') {
    ctx.status = 400;
    ctx.body = { success: false, message: '该优惠券已使用' };
    return;
  }

  const now = new Date().toISOString();
  if (userCoupon.status === 'expired' || userCoupon.end_time < now) {
    ctx.status = 400;
    ctx.body = { success: false, message: '该优惠券已过期' };
    return;
  }

  if (userCoupon.coupon_status !== 1) {
    ctx.status = 400;
    ctx.body = { success: false, message: '该优惠券已失效' };
    return;
  }

  const couponData = {
    type: userCoupon.type,
    value: userCoupon.value,
    min_amount: userCoupon.min_amount
  };
  const validation = calculateCouponDiscount(couponData, total_amount);

  if (!validation.valid) {
    ctx.body = {
      success: false,
      message: validation.reason || '优惠券不可用',
      data: { valid: false, discount: 0 }
    };
    return;
  }

  ctx.body = {
    success: true,
    data: {
      valid: true,
      discount: validation.discount,
      name: userCoupon.name,
      display_text: getCouponDisplayText(userCoupon)
    }
  };
});

router.put('/:id', authMiddleware, async (ctx) => {
  const { id } = ctx.params;
  const {
    name,
    type,
    value,
    min_amount,
    total_count,
    start_time,
    end_time,
    status,
    description,
    per_user_limit
  } = ctx.request.body;

  const existing = await getQuery('SELECT * FROM coupons WHERE id = ?', [id]);
  if (!existing) {
    ctx.status = 404;
    ctx.body = { success: false, message: '优惠券不存在' };
    return;
  }

  const updateFields = [];
  const updateValues = [];

  if (name !== undefined) { updateFields.push('name = ?'); updateValues.push(name); }
  if (type !== undefined) {
    const validTypes = ['fixed', 'percent'];
    if (!validTypes.includes(type)) {
      ctx.status = 400;
      ctx.body = { success: false, message: '无效的优惠券类型' };
      return;
    }
    updateFields.push('type = ?'); updateValues.push(type);
  }
  if (value !== undefined) {
    if (type === 'percent' && (value <= 0 || value > 1)) {
      ctx.status = 400;
      ctx.body = { success: false, message: '折扣券面值必须在0到1之间' };
      return;
    }
    updateFields.push('value = ?'); updateValues.push(value);
  }
  if (min_amount !== undefined) { updateFields.push('min_amount = ?'); updateValues.push(min_amount); }
  if (total_count !== undefined) { updateFields.push('total_count = ?'); updateValues.push(total_count); }
  if (start_time !== undefined) { updateFields.push('start_time = ?'); updateValues.push(start_time); }
  if (end_time !== undefined) { updateFields.push('end_time = ?'); updateValues.push(end_time); }
  if (status !== undefined) { updateFields.push('status = ?'); updateValues.push(status); }
  if (description !== undefined) { updateFields.push('description = ?'); updateValues.push(description); }
  if (per_user_limit !== undefined) { updateFields.push('per_user_limit = ?'); updateValues.push(per_user_limit); }

  if (updateFields.length > 0) {
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(id);
    await runQuery(`UPDATE coupons SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);
  }

  ctx.body = {
    success: true,
    message: '优惠券更新成功'
  };
});

router.delete('/:id', authMiddleware, async (ctx) => {
  const { id } = ctx.params;

  const existing = await getQuery('SELECT * FROM coupons WHERE id = ?', [id]);
  if (!existing) {
    ctx.status = 404;
    ctx.body = { success: false, message: '优惠券不存在' };
    return;
  }

  await runQuery('DELETE FROM coupons WHERE id = ?', [id]);

  ctx.body = {
    success: true,
    message: '优惠券已删除'
  };
});

export default router;
