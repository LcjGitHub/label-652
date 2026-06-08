import Router from 'koa-router';
import { runQuery, getQuery, allQuery } from '../database.js';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js';

const router = new Router({ prefix: '/api/recommendations' });

async function recordBrowse(productId, userId) {
  if (!productId) return;
  
  await runQuery(
    `INSERT INTO browse_history (user_id, product_id) 
     VALUES (?, ?)`,
    [userId, productId]
  );
  
  await runQuery(
    `DELETE FROM browse_history 
     WHERE id NOT IN (
       SELECT id FROM browse_history 
       WHERE user_id IS ? OR user_id = ? 
       ORDER BY viewed_at DESC 
       LIMIT 50
     )
     AND (user_id IS ? OR user_id = ?)`,
    [userId, userId, userId, userId]
  );
}

router.get('/browse/:productId', optionalAuthMiddleware, async (ctx) => {
  const { productId } = ctx.params;
  
  const userId = ctx.state.user ? ctx.state.user.id : null;
  recordBrowse(productId, userId);
  
  ctx.body = {
    success: true,
    message: '浏览记录已记录'
  };
});

router.get('/similar/:productId', async (ctx) => {
  const { productId } = ctx.params;
  const { limit = 8 } = ctx.query;
  const limitNum = parseInt(limit);
  
  const product = await getQuery('SELECT * FROM products WHERE id = ?', [productId]);
  
  if (!product) {
    ctx.status = 404;
    ctx.body = { success: false, message: '商品不存在' };
    return;
  }
  
  const similarProducts = await allQuery(`
    SELECT p.*, 
           COALESCE(r.avg_rating, 0) as avg_rating,
           COALESCE(r.review_count, 0) as review_count,
           COALESCE(oi.sales_count, 0) as sales_count,
           CASE 
             WHEN LOWER(p.name) LIKE LOWER(?) THEN 3
             WHEN p.category = ? THEN 2
             ELSE 1
           END as match_score
    FROM products p
    LEFT JOIN (
      SELECT product_id, AVG(rating) as avg_rating, COUNT(*) as review_count
      FROM reviews
      GROUP BY product_id
    ) r ON p.id = r.product_id
    LEFT JOIN (
      SELECT product_id, SUM(quantity) as sales_count
      FROM order_items
      GROUP BY product_id
    ) oi ON p.id = oi.product_id
    WHERE p.id != ?
    AND (
      p.category = ? 
      OR LOWER(p.name) LIKE LOWER(?)
      OR LOWER(p.description) LIKE LOWER(?)
    )
    ORDER BY match_score DESC, COALESCE(r.avg_rating, 0) DESC, COALESCE(oi.sales_count, 0) DESC
    LIMIT ?
  `, [`%${product.name.split(' ')[0]}%`, product.category, productId, product.category, `%${product.name.split(' ')[0]}%`, `%${product.category}%`, limitNum]);
  
  ctx.body = {
    success: true,
    data: similarProducts
  };
});

router.get('/for-user', authMiddleware, async (ctx) => {
  const { limit = 12 } = ctx.query;
  const userId = ctx.state.user.id;
  const limitNum = parseInt(limit);
  
  const browseHistory = await allQuery(`
    SELECT DISTINCT product_id, category
    FROM browse_history bh
    JOIN products p ON bh.product_id = p.id
    WHERE bh.user_id = ?
    ORDER BY bh.viewed_at DESC
    LIMIT 20
  `, [userId]);
  
  const purchaseHistory = await allQuery(`
    SELECT DISTINCT oi.product_id, p.category
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    JOIN products p ON oi.product_id = p.id
    WHERE o.user_id = ?
    ORDER BY o.created_at DESC
    LIMIT 20
  `, [userId]);
  
  const categoryScores = {};
  
  browseHistory.forEach(item => {
    categoryScores[item.category] = (categoryScores[item.category] || 0) + 2;
  });
  
  purchaseHistory.forEach(item => {
    categoryScores[item.category] = (categoryScores[item.category] || 0) + 3;
  });
  
  const viewedProductIds = new Set([
    ...browseHistory.map(b => b.product_id),
    ...purchaseHistory.map(p => p.product_id)
  ]);
  
  const sortedCategories = Object.entries(categoryScores)
    .sort((a, b) => b[1] - a[1])
    .map(([category]) => category);
  
  let recommendedProducts = [];
  
  if (sortedCategories.length > 0) {
    const categoryPlaceholders = sortedCategories.map(() => '?').join(', ');
    const viewedPlaceholders = viewedProductIds.size > 0 
      ? `AND p.id NOT IN (${Array.from(viewedProductIds).map(() => '?').join(', ')})`
      : '';
    
    const params = [
      ...sortedCategories,
      ...sortedCategories.map(c => `%${c}%`),
      ...Array.from(viewedProductIds),
      limitNum
    ];
    
    recommendedProducts = await allQuery(`
      SELECT p.*,
             COALESCE(r.avg_rating, 0) as avg_rating,
             COALESCE(r.review_count, 0) as review_count,
             COALESCE(oi.sales_count, 0) as sales_count,
             CASE p.category
               ${sortedCategories.map((cat, i) => `WHEN ? THEN ${sortedCategories.length - i}`).join(' ')}
               ELSE 0
             END as category_score
      FROM products p
      LEFT JOIN (
        SELECT product_id, AVG(rating) as avg_rating, COUNT(*) as review_count
        FROM reviews
        GROUP BY product_id
      ) r ON p.id = r.product_id
      LEFT JOIN (
        SELECT product_id, SUM(quantity) as sales_count
        FROM order_items
        GROUP BY product_id
      ) oi ON p.id = oi.product_id
      WHERE p.category IN (${categoryPlaceholders})
         OR LOWER(p.name) LIKE ${sortedCategories.map(() => 'LOWER(?)').join(' OR LOWER(p.name) LIKE ')}
      ${viewedPlaceholders}
      ORDER BY category_score DESC, COALESCE(r.avg_rating, 0) DESC, COALESCE(oi.sales_count, 0) DESC
      LIMIT ?
    `, params);
  }
  
  if (recommendedProducts.length < limitNum) {
    const remainingLimit = limitNum - recommendedProducts.length;
    const existingIds = recommendedProducts.map(p => p.id);
    
    let excludeClause = '';
    let excludeParams = [];
    
    if (existingIds.length > 0) {
      excludeClause = `WHERE id NOT IN (${existingIds.map(() => '?').join(', ')})`;
      excludeParams = existingIds;
    }
    
    const popularProducts = await allQuery(`
      SELECT p.*,
             COALESCE(r.avg_rating, 0) as avg_rating,
             COALESCE(r.review_count, 0) as review_count,
             COALESCE(oi.sales_count, 0) as sales_count
      FROM products p
      LEFT JOIN (
        SELECT product_id, AVG(rating) as avg_rating, COUNT(*) as review_count
        FROM reviews
        GROUP BY product_id
      ) r ON p.id = r.product_id
      LEFT JOIN (
        SELECT product_id, SUM(quantity) as sales_count
        FROM order_items
        GROUP BY product_id
      ) oi ON p.id = oi.product_id
      ${excludeClause}
      ORDER BY COALESCE(oi.sales_count, 0) DESC, COALESCE(r.avg_rating, 0) DESC
      LIMIT ?
    `, [...excludeParams, remainingLimit]);
    
    recommendedProducts = [...recommendedProducts, ...popularProducts];
  }
  
  ctx.body = {
    success: true,
    data: recommendedProducts.slice(0, limitNum)
  };
});

router.get('/hot', async (ctx) => {
  const { limit = 10 } = ctx.query;
  const limitNum = parseInt(limit);
  
  const hotProducts = await allQuery(`
    SELECT p.*,
           COALESCE(r.avg_rating, 0) as avg_rating,
           COALESCE(r.review_count, 0) as review_count,
           COALESCE(oi.sales_count, 0) as sales_count
    FROM products p
    LEFT JOIN (
      SELECT product_id, AVG(rating) as avg_rating, COUNT(*) as review_count
      FROM reviews
      GROUP BY product_id
    ) r ON p.id = r.product_id
    LEFT JOIN (
      SELECT product_id, SUM(quantity) as sales_count
      FROM order_items
      GROUP BY product_id
    ) oi ON p.id = oi.product_id
    ORDER BY COALESCE(oi.sales_count, 0) DESC, COALESCE(r.avg_rating, 0) DESC, p.created_at DESC
    LIMIT ?
  `, [limitNum]);
  
  ctx.body = {
    success: true,
    data: hotProducts
  };
});

router.get('/new', async (ctx) => {
  const { limit = 10 } = ctx.query;
  const limitNum = parseInt(limit);
  
  const newProducts = await allQuery(`
    SELECT p.*,
           COALESCE(r.avg_rating, 0) as avg_rating,
           COALESCE(r.review_count, 0) as review_count,
           COALESCE(oi.sales_count, 0) as sales_count
    FROM products p
    LEFT JOIN (
      SELECT product_id, AVG(rating) as avg_rating, COUNT(*) as review_count
      FROM reviews
      GROUP BY product_id
    ) r ON p.id = r.product_id
    LEFT JOIN (
      SELECT product_id, SUM(quantity) as sales_count
      FROM order_items
      GROUP BY product_id
    ) oi ON p.id = oi.product_id
    ORDER BY p.created_at DESC
    LIMIT ?
  `, [limitNum]);
  
  ctx.body = {
    success: true,
    data: newProducts
  };
});

export default router;
