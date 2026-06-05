const Router = require('koa-router');
const { categories, runQuery, getQuery, allQuery } = require('../database');

const router = new Router({ prefix: '/api/products' });

router.get('/', async (ctx) => {
  const { category, page = 1, limit = 10 } = ctx.query;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  let whereClause = '';
  let params = [];

  if (category && category !== 'all') {
    whereClause = 'WHERE category = ?';
    params.push(category);
  }

  const countResult = getQuery(`SELECT COUNT(*) as total FROM products ${whereClause}`, params);
  const total = countResult.total;

  const products = allQuery(`
    SELECT * FROM products ${whereClause}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `, [...params, limitNum, offset]);

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

router.get('/categories', async (ctx) => {
  ctx.body = {
    success: true,
    data: categories
  };
});

router.get('/:id', async (ctx) => {
  const { id } = ctx.params;
  const product = getQuery('SELECT * FROM products WHERE id = ?', [id]);

  if (!product) {
    ctx.status = 404;
    ctx.body = { success: false, message: '商品不存在' };
    return;
  }

  ctx.body = { success: true, data: product };
});

router.post('/', async (ctx) => {
  const { name, description, price, category, stock = 0, image } = ctx.request.body;

  if (!name || !price || !category) {
    ctx.status = 400;
    ctx.body = { success: false, message: '商品名称、价格和分类为必填项' };
    return;
  }

  if (!categories.includes(category)) {
    ctx.status = 400;
    ctx.body = { success: false, message: '无效的商品分类' };
    return;
  }

  const result = runQuery(`
    INSERT INTO products (name, description, price, category, stock, image)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [name, description, price, category, stock, image]);

  ctx.status = 201;
  ctx.body = {
    success: true,
    data: { id: result.lastID, name, description, price, category, stock, image }
  };
});

router.put('/:id', async (ctx) => {
  const { id } = ctx.params;
  const { name, description, price, category, stock, image } = ctx.request.body;

  const existing = getQuery('SELECT * FROM products WHERE id = ?', [id]);

  if (!existing) {
    ctx.status = 404;
    ctx.body = { success: false, message: '商品不存在' };
    return;
  }

  if (category && !categories.includes(category)) {
    ctx.status = 400;
    ctx.body = { success: false, message: '无效的商品分类' };
    return;
  }

  const updateFields = [];
  const updateValues = [];

  if (name !== undefined) { updateFields.push('name = ?'); updateValues.push(name); }
  if (description !== undefined) { updateFields.push('description = ?'); updateValues.push(description); }
  if (price !== undefined) { updateFields.push('price = ?'); updateValues.push(price); }
  if (category !== undefined) { updateFields.push('category = ?'); updateValues.push(category); }
  if (stock !== undefined) { updateFields.push('stock = ?'); updateValues.push(stock); }
  if (image !== undefined) { updateFields.push('image = ?'); updateValues.push(image); }

  updateFields.push('updated_at = CURRENT_TIMESTAMP');
  updateValues.push(id);

  runQuery(`
    UPDATE products SET ${updateFields.join(', ')}
    WHERE id = ?
  `, updateValues);

  const updatedProduct = getQuery('SELECT * FROM products WHERE id = ?', [id]);

  ctx.body = { success: true, data: updatedProduct };
});

router.delete('/:id', async (ctx) => {
  const { id } = ctx.params;

  const existing = getQuery('SELECT * FROM products WHERE id = ?', [id]);

  if (!existing) {
    ctx.status = 404;
    ctx.body = { success: false, message: '商品不存在' };
    return;
  }

  runQuery('DELETE FROM products WHERE id = ?', [id]);

  ctx.body = { success: true, message: '删除成功' };
});

module.exports = router;
