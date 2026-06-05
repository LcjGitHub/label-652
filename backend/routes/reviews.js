const Router = require('koa-router');
const { runQuery, getQuery, allQuery } = require('../database');
const { authMiddleware } = require('../middleware/auth');

const router = new Router({ prefix: '/api/reviews' });

router.get('/product/:productId', async (ctx) => {
  const { productId } = ctx.params;
  const { page = 1, limit = 10, sortBy = 'created_at', sortOrder = 'desc', rating } = ctx.query;

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  const product = await getQuery('SELECT id FROM products WHERE id = ?', [productId]);
  if (!product) {
    ctx.status = 404;
    ctx.body = { success: false, message: '商品不存在' };
    return;
  }

  let whereClause = 'WHERE product_id = ?';
  let params = [productId];

  if (rating && rating !== 'all') {
    const ratingNum = parseInt(rating);
    if (ratingNum >= 1 && ratingNum <= 5) {
      whereClause += ' AND rating = ?';
      params.push(ratingNum);
    }
  }

  const countResult = await getQuery(`SELECT COUNT(*) as total FROM reviews ${whereClause}`, params);
  const total = countResult.total;

  const validSortFields = ['created_at', 'updated_at', 'rating'];
  const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
  const sortDir = sortOrder === 'asc' ? 'ASC' : 'DESC';

  const reviews = await allQuery(`
    SELECT reviews.*, users.username, users.avatar
    FROM reviews
    INNER JOIN users ON reviews.user_id = users.id
    ${whereClause}
    ORDER BY ${sortField} ${sortDir}
    LIMIT ? OFFSET ?
  `, [...params, limitNum, offset]);

  const processedReviews = reviews.map(review => ({
    ...review,
    images: review.images ? JSON.parse(review.images) : []
  }));

  ctx.body = {
    success: true,
    data: {
      reviews: processedReviews,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    }
  };
});

router.get('/product/:productId/stats', async (ctx) => {
  const { productId } = ctx.params;

  const product = await getQuery('SELECT id FROM products WHERE id = ?', [productId]);
  if (!product) {
    ctx.status = 404;
    ctx.body = { success: false, message: '商品不存在' };
    return;
  }

  const statsResult = await getQuery(`
    SELECT
      COUNT(*) as total_reviews,
      AVG(rating) as average_rating,
      SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as count_5,
      SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as count_4,
      SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as count_3,
      SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as count_2,
      SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as count_1
    FROM reviews
    WHERE product_id = ?
  `, [productId]);

  const stats = {
    totalReviews: statsResult.total_reviews || 0,
    averageRating: statsResult.average_rating ? parseFloat(statsResult.average_rating).toFixed(1) : 0,
    ratingDistribution: {
      5: statsResult.count_5 || 0,
      4: statsResult.count_4 || 0,
      3: statsResult.count_3 || 0,
      2: statsResult.count_2 || 0,
      1: statsResult.count_1 || 0
    }
  };

  ctx.body = {
    success: true,
    data: stats
  };
});

router.get('/:id', async (ctx) => {
  const { id } = ctx.params;

  const review = await getQuery(`
    SELECT reviews.*, users.username, users.avatar
    FROM reviews
    INNER JOIN users ON reviews.user_id = users.id
    WHERE reviews.id = ?
  `, [id]);

  if (!review) {
    ctx.status = 404;
    ctx.body = { success: false, message: '评价不存在' };
    return;
  }

  review.images = review.images ? JSON.parse(review.images) : [];

  ctx.body = { success: true, data: review };
});

router.post('/', authMiddleware, async (ctx) => {
  const { product_id, rating, content, images = [] } = ctx.request.body;
  const userId = ctx.state.user.id;

  if (!product_id || !rating) {
    ctx.status = 400;
    ctx.body = { success: false, message: '商品ID和评分为必填项' };
    return;
  }

  const ratingNum = parseInt(rating);
  if (ratingNum < 1 || ratingNum > 5) {
    ctx.status = 400;
    ctx.body = { success: false, message: '评分必须在1-5之间' };
    return;
  }

  const product = await getQuery('SELECT id FROM products WHERE id = ?', [product_id]);
  if (!product) {
    ctx.status = 404;
    ctx.body = { success: false, message: '商品不存在' };
    return;
  }

  const existingReview = await getQuery(
    'SELECT id FROM reviews WHERE user_id = ? AND product_id = ?',
    [userId, product_id]
  );
  if (existingReview) {
    ctx.status = 400;
    ctx.body = { success: false, message: '您已经评价过该商品' };
    return;
  }

  const imagesJson = JSON.stringify(images);

  const result = await runQuery(`
    INSERT INTO reviews (user_id, product_id, rating, content, images)
    VALUES (?, ?, ?, ?, ?)
  `, [userId, product_id, ratingNum, content, imagesJson]);

  const newReview = await getQuery(`
    SELECT reviews.*, users.username, users.avatar
    FROM reviews
    INNER JOIN users ON reviews.user_id = users.id
    WHERE reviews.id = ?
  `, [result.lastID]);

  newReview.images = newReview.images ? JSON.parse(newReview.images) : [];

  ctx.status = 201;
  ctx.body = { success: true, data: newReview };
});

router.put('/:id', authMiddleware, async (ctx) => {
  const { id } = ctx.params;
  const { rating, content, images } = ctx.request.body;
  const userId = ctx.state.user.id;

  const existing = await getQuery('SELECT * FROM reviews WHERE id = ?', [id]);
  if (!existing) {
    ctx.status = 404;
    ctx.body = { success: false, message: '评价不存在' };
    return;
  }

  if (existing.user_id !== userId) {
    ctx.status = 403;
    ctx.body = { success: false, message: '无权限修改此评价' };
    return;
  }

  if (rating !== undefined) {
    const ratingNum = parseInt(rating);
    if (ratingNum < 1 || ratingNum > 5) {
      ctx.status = 400;
      ctx.body = { success: false, message: '评分必须在1-5之间' };
      return;
    }
  }

  const updateFields = [];
  const updateValues = [];

  if (rating !== undefined) { updateFields.push('rating = ?'); updateValues.push(rating); }
  if (content !== undefined) { updateFields.push('content = ?'); updateValues.push(content); }
  if (images !== undefined) {
    updateFields.push('images = ?');
    updateValues.push(JSON.stringify(images));
  }

  updateFields.push('updated_at = CURRENT_TIMESTAMP');
  updateValues.push(id);

  await runQuery(`
    UPDATE reviews SET ${updateFields.join(', ')}
    WHERE id = ?
  `, updateValues);

  const updatedReview = await getQuery(`
    SELECT reviews.*, users.username, users.avatar
    FROM reviews
    INNER JOIN users ON reviews.user_id = users.id
    WHERE reviews.id = ?
  `, [id]);

  updatedReview.images = updatedReview.images ? JSON.parse(updatedReview.images) : [];

  ctx.body = { success: true, data: updatedReview };
});

router.delete('/:id', authMiddleware, async (ctx) => {
  const { id } = ctx.params;
  const userId = ctx.state.user.id;

  const existing = await getQuery('SELECT * FROM reviews WHERE id = ?', [id]);
  if (!existing) {
    ctx.status = 404;
    ctx.body = { success: false, message: '评价不存在' };
    return;
  }

  if (existing.user_id !== userId) {
    ctx.status = 403;
    ctx.body = { success: false, message: '无权限删除此评价' };
    return;
  }

  await runQuery('DELETE FROM reviews WHERE id = ?', [id]);

  ctx.body = { success: true, message: '删除成功' };
});

router.get('/user/my', authMiddleware, async (ctx) => {
  const userId = ctx.state.user.id;
  const { page = 1, limit = 10 } = ctx.query;

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  const countResult = await getQuery('SELECT COUNT(*) as total FROM reviews WHERE user_id = ?', [userId]);
  const total = countResult.total;

  const reviews = await allQuery(`
    SELECT reviews.*, products.name as product_name, products.image as product_image
    FROM reviews
    INNER JOIN products ON reviews.product_id = products.id
    WHERE reviews.user_id = ?
    ORDER BY reviews.created_at DESC
    LIMIT ? OFFSET ?
  `, [userId, limitNum, offset]);

  const processedReviews = reviews.map(review => ({
    ...review,
    images: review.images ? JSON.parse(review.images) : []
  }));

  ctx.body = {
    success: true,
    data: {
      reviews: processedReviews,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    }
  };
});

module.exports = router;
