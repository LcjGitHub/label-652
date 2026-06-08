import Router from 'koa-router';
import { runQuery, getQuery, allQuery } from '../database.js';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js';

const router = new Router({ prefix: '/api/search' });

async function recordSearch(keyword, userId) {
  if (!keyword || keyword.trim().length === 0) return;
  
  const trimmedKeyword = keyword.trim().toLowerCase();
  
  let whereClause = 'WHERE LOWER(keyword) = ?';
  let params = [trimmedKeyword];
  
  if (userId) {
    whereClause += ' AND user_id = ?';
    params.push(userId);
  } else {
    whereClause += ' AND user_id IS NULL';
  }
  
  const existing = await getQuery(
    `SELECT * FROM search_history ${whereClause}`,
    params
  );
  
  if (existing) {
    await runQuery(
      `UPDATE search_history 
       SET search_count = search_count + 1, 
           last_searched_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [existing.id]
    );
  } else {
    await runQuery(
      `INSERT INTO search_history (keyword, user_id, search_count) 
       VALUES (?, ?, 1)`,
      [trimmedKeyword, userId]
    );
  }
}

router.get('/', optionalAuthMiddleware, async (ctx) => {
  const { 
    q, 
    category, 
    minPrice, 
    maxPrice, 
    sortBy = 'relevance', 
    sortOrder = 'desc',
    page = 1, 
    limit = 12 
  } = ctx.query;
  
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;
  
  let whereClauses = [];
  let params = [];
  
  if (q && q.trim()) {
    const keyword = `%${q.trim().toLowerCase()}%`;
    whereClauses.push(`(
      LOWER(p.name) LIKE ? OR 
      LOWER(p.description) LIKE ? OR 
      LOWER(p.category) LIKE ?
    )`);
    params.push(keyword, keyword, keyword);
  }
  
  if (category && category !== 'all') {
    whereClauses.push('p.category = ?');
    params.push(category);
  }
  
  if (minPrice !== undefined && minPrice !== '') {
    whereClauses.push('p.price >= ?');
    params.push(parseFloat(minPrice));
  }
  
  if (maxPrice !== undefined && maxPrice !== '') {
    whereClauses.push('p.price <= ?');
    params.push(parseFloat(maxPrice));
  }
  
  const whereClause = whereClauses.length > 0 
    ? 'WHERE ' + whereClauses.join(' AND ') 
    : '';
  
  let orderClause = '';
  switch (sortBy) {
    case 'price':
      orderClause = `ORDER BY p.price ${sortOrder === 'asc' ? 'ASC' : 'DESC'}`;
      break;
    case 'sales':
      orderClause = `ORDER BY COALESCE(sales_count, 0) ${sortOrder === 'asc' ? 'ASC' : 'DESC'}`;
      break;
    case 'rating':
      orderClause = `ORDER BY COALESCE(avg_rating, 0) ${sortOrder === 'asc' ? 'ASC' : 'DESC'}`;
      break;
    case 'newest':
      orderClause = 'ORDER BY p.created_at DESC';
      break;
    case 'relevance':
    default:
      if (q && q.trim()) {
        orderClause = `ORDER BY 
          CASE WHEN LOWER(p.name) LIKE ? THEN 1 ELSE 2 END,
          CASE WHEN LOWER(p.description) LIKE ? THEN 1 ELSE 2 END,
          p.created_at DESC`;
        const exactMatch = `%${q.trim().toLowerCase()}%`;
        params.push(exactMatch, exactMatch);
      } else {
        orderClause = 'ORDER BY p.created_at DESC';
      }
      break;
  }
  
  const countSql = `
    SELECT COUNT(DISTINCT p.id) as total 
    FROM products p
    LEFT JOIN (
      SELECT product_id, SUM(quantity) as sales_count
      FROM order_items
      GROUP BY product_id
    ) oi ON p.id = oi.product_id
    LEFT JOIN (
      SELECT product_id, AVG(rating) as avg_rating
      FROM reviews
      GROUP BY product_id
    ) r ON p.id = r.product_id
    ${whereClause}
  `;
  
  const countResult = await getQuery(countSql, params);
  const total = countResult.total;
  
  const dataSql = `
    SELECT p.*, 
           COALESCE(oi.sales_count, 0) as sales_count,
           COALESCE(r.avg_rating, 0) as avg_rating,
           COALESCE(r.review_count, 0) as review_count
    FROM products p
    LEFT JOIN (
      SELECT product_id, SUM(quantity) as sales_count
      FROM order_items
      GROUP BY product_id
    ) oi ON p.id = oi.product_id
    LEFT JOIN (
      SELECT product_id, AVG(rating) as avg_rating, COUNT(*) as review_count
      FROM reviews
      GROUP BY product_id
    ) r ON p.id = r.product_id
    ${whereClause}
    ${orderClause}
    LIMIT ? OFFSET ?
  `;
  
  const products = await allQuery(dataSql, [...params, limitNum, offset]);
  
  if (q && q.trim() && ctx.state.user) {
    recordSearch(q.trim(), ctx.state.user.id);
  } else if (q && q.trim()) {
    recordSearch(q.trim(), null);
  }
  
  ctx.body = {
    success: true,
    data: {
      products,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    }
  };
});

router.get('/suggestions', async (ctx) => {
  const { q, limit = 8 } = ctx.query;
  
  if (!q || q.trim().length === 0) {
    ctx.body = {
      success: true,
      data: []
    };
    return;
  }
  
  const keyword = `%${q.trim().toLowerCase()}%`;
  const limitNum = parseInt(limit);
  
  const suggestions = await allQuery(`
    SELECT DISTINCT 
      id,
      name,
      category,
      SUBSTR(description, 1, 100) as description,
      CASE 
        WHEN LOWER(name) LIKE ? THEN 1
        WHEN LOWER(category) LIKE ? THEN 2
        WHEN LOWER(description) LIKE ? THEN 3
        ELSE 4
      END as priority
    FROM products
    WHERE LOWER(name) LIKE ? 
       OR LOWER(description) LIKE ? 
       OR LOWER(category) LIKE ?
    ORDER BY priority, name
    LIMIT ?
  `, [keyword, keyword, keyword, keyword, keyword, keyword, limitNum]);
  
  ctx.body = {
    success: true,
    data: suggestions
  };
});

router.get('/hot', async (ctx) => {
  const { limit = 10 } = ctx.query;
  const limitNum = parseInt(limit);
  
  const hotKeywords = await allQuery(`
    SELECT keyword, SUM(search_count) as total_count
    FROM search_history
    WHERE keyword IS NOT NULL AND keyword != ''
    GROUP BY LOWER(keyword)
    ORDER BY total_count DESC, last_searched_at DESC
    LIMIT ?
  `, [limitNum]);
  
  ctx.body = {
    success: true,
    data: hotKeywords
  };
});

router.get('/history', authMiddleware, async (ctx) => {
  const { limit = 10 } = ctx.query;
  const userId = ctx.state.user.id;
  const limitNum = parseInt(limit);
  
  const history = await allQuery(`
    SELECT keyword, MAX(last_searched_at) as last_searched
    FROM search_history
    WHERE user_id = ? AND keyword IS NOT NULL AND keyword != ''
    GROUP BY LOWER(keyword)
    ORDER BY last_searched DESC
    LIMIT ?
  `, [userId, limitNum]);
  
  ctx.body = {
    success: true,
    data: history
  };
});

router.delete('/history', authMiddleware, async (ctx) => {
  const userId = ctx.state.user.id;
  
  await runQuery('DELETE FROM search_history WHERE user_id = ?', [userId]);
  
  ctx.body = {
    success: true,
    message: '搜索历史已清空'
  };
});

export default router;
