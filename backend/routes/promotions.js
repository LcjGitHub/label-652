import Router from 'koa-router';
import {
  runQuery,
  getQuery,
  allQuery,
  getProductActivePromotion,
  getPromotionDisplayText,
  getAllActivePromotions
} from '../database.js';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js';
import { getCache, CACHE_KEYS } from '../cache.js';

const router = new Router({ prefix: '/api/promotions' });

router.get('/', optionalAuthMiddleware, async (ctx) => {
  const { active } = ctx.query;
  let whereClause = '';
  const params = [];

  if (active === 'true') {
    const now = new Date().toISOString();
    whereClause = 'WHERE status = 1 AND start_time <= ? AND end_time >= ?';
    params.push(now, now);
  }

  const promotions = await allQuery(`
    SELECT * FROM promotions
    ${whereClause}
    ORDER BY created_at DESC
  `, params);

  for (const promo of promotions) {
    promo.products = await allQuery(`
      SELECT pp.product_id, p.name, p.price, p.image
      FROM promotion_products pp
      INNER JOIN products p ON pp.product_id = p.id
      WHERE pp.promotion_id = ?
    `, [promo.id]);
    if (promo.rules) {
      try {
        promo.rules = JSON.parse(promo.rules);
      } catch (e) {}
    }
    promo.display_text = getPromotionDisplayText(promo);
  }

  ctx.body = {
    success: true,
    data: promotions
  };
});

router.get('/product/:productId', async (ctx) => {
  const { productId } = ctx.params;
  const promotion = await getProductActivePromotion(productId);

  if (promotion) {
    promotion.display_text = getPromotionDisplayText(promotion);
  }

  ctx.body = {
    success: true,
    data: promotion
  };
});

router.get('/:id', async (ctx) => {
  const { id } = ctx.params;
  const promotion = await getQuery('SELECT * FROM promotions WHERE id = ?', [id]);

  if (!promotion) {
    ctx.status = 404;
    ctx.body = { success: false, message: '促销活动不存在' };
    return;
  }

  promotion.products = await allQuery(`
    SELECT pp.product_id, p.name, p.price, p.image, p.category
    FROM promotion_products pp
    INNER JOIN products p ON pp.product_id = p.id
    WHERE pp.promotion_id = ?
  `, [id]);

  if (promotion.rules) {
    try {
      promotion.rules = JSON.parse(promotion.rules);
    } catch (e) {}
  }
  promotion.display_text = getPromotionDisplayText(promotion);

  ctx.body = {
    success: true,
    data: promotion
  };
});

router.post('/', authMiddleware, async (ctx) => {
  const {
    name,
    type,
    description,
    start_time,
    end_time,
    status = 1,
    rules = {},
    product_ids = []
  } = ctx.request.body;

  if (!name || !type || !start_time || !end_time) {
    ctx.status = 400;
    ctx.body = { success: false, message: '活动名称、类型、开始时间和结束时间为必填项' };
    return;
  }

  const validTypes = ['full_reduction', 'discount', 'buy_one_get_one'];
  if (!validTypes.includes(type)) {
    ctx.status = 400;
    ctx.body = { success: false, message: '无效的活动类型' };
    return;
  }

  const rulesStr = typeof rules === 'string' ? rules : JSON.stringify(rules);

  const result = await runQuery(`
    INSERT INTO promotions (name, type, description, start_time, end_time, status, rules)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [name, type, description || '', start_time, end_time, status, rulesStr]);

  const promotionId = result.lastID;

  for (const productId of product_ids) {
    try {
      await runQuery(
        'INSERT INTO promotion_products (promotion_id, product_id) VALUES (?, ?)',
        [promotionId, productId]
      );
    } catch (e) {}
  }

  const cache = getCache();
  await cache.delPattern(`${CACHE_KEYS.PRODUCT_LIST}*`);
  await cache.delPattern(`${CACHE_KEYS.PRODUCT_DETAIL}*`);
  await cache.delPattern(`${CACHE_KEYS.PRODUCT_PROMOTION}*`);

  ctx.status = 201;
  ctx.body = {
    success: true,
    message: '促销活动创建成功',
    data: { id: promotionId }
  };
});

router.put('/:id', authMiddleware, async (ctx) => {
  const { id } = ctx.params;
  const {
    name,
    type,
    description,
    start_time,
    end_time,
    status,
    rules,
    product_ids
  } = ctx.request.body;

  const existing = await getQuery('SELECT * FROM promotions WHERE id = ?', [id]);
  if (!existing) {
    ctx.status = 404;
    ctx.body = { success: false, message: '促销活动不存在' };
    return;
  }

  const updateFields = [];
  const updateValues = [];

  if (name !== undefined) { updateFields.push('name = ?'); updateValues.push(name); }
  if (type !== undefined) {
    const validTypes = ['full_reduction', 'discount', 'buy_one_get_one'];
    if (!validTypes.includes(type)) {
      ctx.status = 400;
      ctx.body = { success: false, message: '无效的活动类型' };
      return;
    }
    updateFields.push('type = ?'); updateValues.push(type);
  }
  if (description !== undefined) { updateFields.push('description = ?'); updateValues.push(description); }
  if (start_time !== undefined) { updateFields.push('start_time = ?'); updateValues.push(start_time); }
  if (end_time !== undefined) { updateFields.push('end_time = ?'); updateValues.push(end_time); }
  if (status !== undefined) { updateFields.push('status = ?'); updateValues.push(status); }
  if (rules !== undefined) {
    updateFields.push('rules = ?');
    updateValues.push(typeof rules === 'string' ? rules : JSON.stringify(rules));
  }
  if (updateFields.length > 0) {
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(id);
    await runQuery(`UPDATE promotions SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);
  }

  if (product_ids !== undefined && Array.isArray(product_ids)) {
    await runQuery('DELETE FROM promotion_products WHERE promotion_id = ?', [id]);
    for (const productId of product_ids) {
      try {
        await runQuery(
          'INSERT INTO promotion_products (promotion_id, product_id) VALUES (?, ?)',
          [id, productId]
        );
      } catch (e) {}
    }
  }

  const cache = getCache();
  await cache.delPattern(`${CACHE_KEYS.PRODUCT_LIST}*`);
  await cache.delPattern(`${CACHE_KEYS.PRODUCT_DETAIL}*`);
  await cache.delPattern(`${CACHE_KEYS.PRODUCT_PROMOTION}*`);

  ctx.body = {
    success: true,
    message: '促销活动更新成功'
  };
});

router.delete('/:id', authMiddleware, async (ctx) => {
  const { id } = ctx.params;

  const existing = await getQuery('SELECT * FROM promotions WHERE id = ?', [id]);
  if (!existing) {
    ctx.status = 404;
    ctx.body = { success: false, message: '促销活动不存在' };
    return;
  }

  await runQuery('DELETE FROM promotions WHERE id = ?', [id]);

  const cache = getCache();
  await cache.delPattern(`${CACHE_KEYS.PRODUCT_LIST}*`);
  await cache.delPattern(`${CACHE_KEYS.PRODUCT_DETAIL}*`);
  await cache.delPattern(`${CACHE_KEYS.PRODUCT_PROMOTION}*`);

  ctx.body = {
    success: true,
    message: '促销活动已删除'
  };
});

export default router;
