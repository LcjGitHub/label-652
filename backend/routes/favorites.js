import Router from 'koa-router';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js';
import {
  runQuery,
  getQuery,
  allQuery,
  getProductSpecs,
  getProductSkus,
  getProductPriceRange,
  getProductStock
} from '../database.js';

async function enrichFavoriteProduct(product) {
  if (!product) return product;
  const enriched = { ...product };
  enriched.has_multi_spec = product.has_multi_spec === 1;

  if (enriched.has_multi_spec) {
    const priceRange = await getProductPriceRange(product.id);
    enriched.min_price = priceRange.min_price;
    enriched.max_price = priceRange.max_price;
    enriched.total_stock = await getProductStock(product.id);
    enriched.specs = await getProductSpecs(product.id);
    enriched.skus = await getProductSkus(product.id);
    for (const sku of enriched.skus) {
      const specsObj = {};
      if (sku.spec_text) {
        for (const part of sku.spec_text.split(/[;\/]/)) {
          const [k, v] = part.split(':');
          if (k && v) specsObj[k.trim()] = v.trim();
        }
      }
      sku.specs = specsObj;
    }
  } else {
    enriched.min_price = product.price;
    enriched.max_price = product.price;
    enriched.total_stock = product.stock;
    enriched.specs = [];
    enriched.skus = [];
  }
  return enriched;
}

const router = new Router({ prefix: '/api/favorites' });

router.get('/', authMiddleware, async (ctx) => {
  const userId = ctx.state.user.id;
  const { page = 1, limit = 20 } = ctx.query;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  const countResult = await getQuery(
    'SELECT COUNT(*) as total FROM favorites WHERE user_id = ?',
    [userId]
  );
  const total = countResult.total;

  const rows = await allQuery(`
    SELECT 
      f.id as favorite_id,
      f.created_at as favorited_at,
      p.id,
      p.name,
      p.description,
      p.price,
      p.category,
      p.stock,
      p.image,
      p.has_multi_spec,
      p.created_at,
      p.updated_at
    FROM favorites f
    INNER JOIN products p ON f.product_id = p.id
    WHERE f.user_id = ?
    ORDER BY f.created_at DESC
    LIMIT ? OFFSET ?
  `, [userId, limitNum, offset]);

  const enrichedRows = [];
  for (const row of rows) {
    enrichedRows.push(await enrichFavoriteProduct(row));
  }

  ctx.body = {
    success: true,
    data: {
      favorites: enrichedRows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    }
  };
});

router.get('/list/ids', authMiddleware, async (ctx) => {
  const userId = ctx.state.user.id;
  const rows = await allQuery(
    'SELECT product_id FROM favorites WHERE user_id = ?',
    [userId]
  );
  const ids = rows.map(r => r.product_id);
  ctx.body = { success: true, data: ids };
});

router.get('/check/:productId', optionalAuthMiddleware, async (ctx) => {
  const productId = parseInt(ctx.params.productId);

  if (!ctx.state.user) {
    ctx.body = { success: true, data: { isFavorited: false } };
    return;
  }

  const userId = ctx.state.user.id;

  if (!productId || isNaN(productId)) {
    ctx.status = 400;
    ctx.body = { success: false, message: '无效的商品 ID' };
    return;
  }

  const favorite = await getQuery(
    'SELECT id FROM favorites WHERE user_id = ? AND product_id = ?',
    [userId, productId]
  );

  ctx.body = {
    success: true,
    data: { isFavorited: !!favorite }
  };
});

router.delete('/batch', authMiddleware, async (ctx) => {
  const userId = ctx.state.user.id;
  const { productIds } = ctx.request.body || {};

  if (!Array.isArray(productIds) || productIds.length === 0) {
    ctx.status = 400;
    ctx.body = { success: false, message: '请提供要取消收藏的商品 ID 列表' };
    return;
  }

  const validIds = productIds.map(id => parseInt(id)).filter(id => !isNaN(id));
  if (validIds.length === 0) {
    ctx.status = 400;
    ctx.body = { success: false, message: '无效的商品 ID 列表' };
    return;
  }

  try {
    const placeholders = validIds.map(() => '?').join(',');
    const result = await runQuery(
      `DELETE FROM favorites WHERE user_id = ? AND product_id IN (${placeholders})`,
      [userId, ...validIds]
    );
    ctx.body = {
      success: true,
      message: `已取消 ${result.changes} 个收藏`,
      data: { count: result.changes }
    };
  } catch (err) {
    ctx.status = 500;
    ctx.body = { success: false, message: '批量取消收藏失败：' + err.message };
  }
});

router.post('/:productId', authMiddleware, async (ctx) => {
  const userId = ctx.state.user.id;
  const productId = parseInt(ctx.params.productId);

  if (!productId || isNaN(productId)) {
    ctx.status = 400;
    ctx.body = { success: false, message: '无效的商品 ID' };
    return;
  }

  const product = await getQuery('SELECT id FROM products WHERE id = ?', [productId]);
  if (!product) {
    ctx.status = 404;
    ctx.body = { success: false, message: '商品不存在' };
    return;
  }

  try {
    await runQuery(
      'INSERT OR IGNORE INTO favorites (user_id, product_id) VALUES (?, ?)',
      [userId, productId]
    );
    ctx.body = { success: true, message: '收藏成功' };
  } catch (err) {
    ctx.status = 500;
    ctx.body = { success: false, message: '收藏失败：' + err.message };
  }
});

router.delete('/:productId', authMiddleware, async (ctx) => {
  const userId = ctx.state.user.id;
  const productId = parseInt(ctx.params.productId);

  if (!productId || isNaN(productId)) {
    ctx.status = 400;
    ctx.body = { success: false, message: '无效的商品 ID' };
    return;
  }

  try {
    const result = await runQuery(
      'DELETE FROM favorites WHERE user_id = ? AND product_id = ?',
      [userId, productId]
    );
    if (result.changes > 0) {
      ctx.body = { success: true, message: '已取消收藏' };
    } else {
      ctx.status = 404;
      ctx.body = { success: false, message: '未找到该收藏记录' };
    }
  } catch (err) {
    ctx.status = 500;
    ctx.body = { success: false, message: '取消收藏失败：' + err.message };
  }
});

export default router;
