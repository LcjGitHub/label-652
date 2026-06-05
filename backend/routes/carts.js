const Router = require('koa-router');
const { runQuery, getQuery, allQuery } = require('../database');
const { authMiddleware } = require('../middleware/auth');

const router = new Router({ prefix: '/api/cart' });

router.get('/', authMiddleware, async (ctx) => {
  const userId = ctx.state.user.id;

  const cartItems = await allQuery(`
    SELECT 
      c.id,
      c.user_id,
      c.product_id,
      c.quantity,
      c.created_at,
      c.updated_at,
      p.name,
      p.description,
      p.price,
      p.category,
      p.stock,
      p.image
    FROM carts c
    INNER JOIN products p ON c.product_id = p.id
    WHERE c.user_id = ?
    ORDER BY c.created_at DESC
  `, [userId]);

  const totalCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  ctx.body = {
    success: true,
    data: {
      items: cartItems,
      totalCount,
      totalPrice
    }
  };
});

router.post('/add', authMiddleware, async (ctx) => {
  const userId = ctx.state.user.id;
  const { product_id, quantity = 1 } = ctx.request.body;

  if (!product_id) {
    ctx.status = 400;
    ctx.body = { success: false, message: '商品ID为必填项' };
    return;
  }

  const qty = parseInt(quantity);
  if (isNaN(qty) || qty < 1) {
    ctx.status = 400;
    ctx.body = { success: false, message: '商品数量必须大于0' };
    return;
  }

  const product = await getQuery('SELECT * FROM products WHERE id = ?', [product_id]);
  if (!product) {
    ctx.status = 404;
    ctx.body = { success: false, message: '商品不存在' };
    return;
  }

  const existingItem = await getQuery(
    'SELECT * FROM carts WHERE user_id = ? AND product_id = ?',
    [userId, product_id]
  );

  if (existingItem) {
    const newQuantity = existingItem.quantity + qty;
    if (newQuantity > product.stock) {
      ctx.status = 400;
      ctx.body = { success: false, message: `库存不足，最多可添加 ${product.stock} 件` };
      return;
    }
    await runQuery(
      'UPDATE carts SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newQuantity, existingItem.id]
    );
  } else {
    if (qty > product.stock) {
      ctx.status = 400;
      ctx.body = { success: false, message: `库存不足，最多可添加 ${product.stock} 件` };
      return;
    }
    await runQuery(
      'INSERT INTO carts (user_id, product_id, quantity) VALUES (?, ?, ?)',
      [userId, product_id, qty]
    );
  }

  const cartItems = await allQuery(`
    SELECT 
      c.id,
      c.user_id,
      c.product_id,
      c.quantity,
      c.created_at,
      c.updated_at,
      p.name,
      p.description,
      p.price,
      p.category,
      p.stock,
      p.image
    FROM carts c
    INNER JOIN products p ON c.product_id = p.id
    WHERE c.user_id = ?
    ORDER BY c.created_at DESC
  `, [userId]);

  const totalCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  ctx.body = {
    success: true,
    message: '已添加到购物车',
    data: {
      items: cartItems,
      totalCount,
      totalPrice
    }
  };
});

router.put('/update/:productId', authMiddleware, async (ctx) => {
  const userId = ctx.state.user.id;
  const { productId } = ctx.params;
  const { quantity } = ctx.request.body;

  const qty = parseInt(quantity);
  if (isNaN(qty) || qty < 1) {
    ctx.status = 400;
    ctx.body = { success: false, message: '商品数量必须大于0' };
    return;
  }

  const product = await getQuery('SELECT * FROM products WHERE id = ?', [productId]);
  if (!product) {
    ctx.status = 404;
    ctx.body = { success: false, message: '商品不存在' };
    return;
  }

  if (qty > product.stock) {
    ctx.status = 400;
    ctx.body = { success: false, message: `库存不足，最多可添加 ${product.stock} 件` };
    return;
  }

  const existingItem = await getQuery(
    'SELECT * FROM carts WHERE user_id = ? AND product_id = ?',
    [userId, productId]
  );

  if (!existingItem) {
    ctx.status = 404;
    ctx.body = { success: false, message: '购物车中不存在该商品' };
    return;
  }

  await runQuery(
    'UPDATE carts SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [qty, existingItem.id]
  );

  const cartItems = await allQuery(`
    SELECT 
      c.id,
      c.user_id,
      c.product_id,
      c.quantity,
      c.created_at,
      c.updated_at,
      p.name,
      p.description,
      p.price,
      p.category,
      p.stock,
      p.image
    FROM carts c
    INNER JOIN products p ON c.product_id = p.id
    WHERE c.user_id = ?
    ORDER BY c.created_at DESC
  `, [userId]);

  const totalCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  ctx.body = {
    success: true,
    data: {
      items: cartItems,
      totalCount,
      totalPrice
    }
  };
});

router.delete('/remove/:productId', authMiddleware, async (ctx) => {
  const userId = ctx.state.user.id;
  const { productId } = ctx.params;

  const existingItem = await getQuery(
    'SELECT * FROM carts WHERE user_id = ? AND product_id = ?',
    [userId, productId]
  );

  if (!existingItem) {
    ctx.status = 404;
    ctx.body = { success: false, message: '购物车中不存在该商品' };
    return;
  }

  await runQuery('DELETE FROM carts WHERE id = ?', [existingItem.id]);

  const cartItems = await allQuery(`
    SELECT 
      c.id,
      c.user_id,
      c.product_id,
      c.quantity,
      c.created_at,
      c.updated_at,
      p.name,
      p.description,
      p.price,
      p.category,
      p.stock,
      p.image
    FROM carts c
    INNER JOIN products p ON c.product_id = p.id
    WHERE c.user_id = ?
    ORDER BY c.created_at DESC
  `, [userId]);

  const totalCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  ctx.body = {
    success: true,
    message: '已从购物车移除',
    data: {
      items: cartItems,
      totalCount,
      totalPrice
    }
  };
});

router.delete('/clear', authMiddleware, async (ctx) => {
  const userId = ctx.state.user.id;

  await runQuery('DELETE FROM carts WHERE user_id = ?', [userId]);

  ctx.body = {
    success: true,
    message: '购物车已清空',
    data: {
      items: [],
      totalCount: 0,
      totalPrice: 0
    }
  };
});

router.post('/merge', authMiddleware, async (ctx) => {
  const userId = ctx.state.user.id;
  const { items } = ctx.request.body;

  if (!items || !Array.isArray(items)) {
    ctx.status = 400;
    ctx.body = { success: false, message: '无效的购物车数据' };
    return;
  }

  for (const item of items) {
    const { product_id, quantity } = item;
    const qty = parseInt(quantity);

    if (!product_id || isNaN(qty) || qty < 1) continue;

    const product = await getQuery('SELECT * FROM products WHERE id = ?', [product_id]);
    if (!product) continue;

    const actualQty = Math.min(qty, product.stock);
    if (actualQty < 1) continue;

    const existingItem = await getQuery(
      'SELECT * FROM carts WHERE user_id = ? AND product_id = ?',
      [userId, product_id]
    );

    if (existingItem) {
      const newQuantity = Math.min(existingItem.quantity + actualQty, product.stock);
      await runQuery(
        'UPDATE carts SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newQuantity, existingItem.id]
      );
    } else {
      await runQuery(
        'INSERT INTO carts (user_id, product_id, quantity) VALUES (?, ?, ?)',
        [userId, product_id, actualQty]
      );
    }
  }

  const cartItems = await allQuery(`
    SELECT 
      c.id,
      c.user_id,
      c.product_id,
      c.quantity,
      c.created_at,
      c.updated_at,
      p.name,
      p.description,
      p.price,
      p.category,
      p.stock,
      p.image
    FROM carts c
    INNER JOIN products p ON c.product_id = p.id
    WHERE c.user_id = ?
    ORDER BY c.created_at DESC
  `, [userId]);

  const totalCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  ctx.body = {
    success: true,
    message: '购物车已同步',
    data: {
      items: cartItems,
      totalCount,
      totalPrice
    }
  };
});

module.exports = router;
