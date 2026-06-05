const Router = require('koa-router');
const { runQuery, getQuery, allQuery } = require('../database');
const { authMiddleware } = require('../middleware/auth');

const router = new Router({ prefix: '/api/orders' });

const generateOrderNo = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const time = date.getTime().toString().slice(-8);
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `ORD${year}${month}${day}${time}${random}`;
};

router.get('/', authMiddleware, async (ctx) => {
  const userId = ctx.state.user.id;
  const { status, page = 1, pageSize = 10 } = ctx.query;

  const offset = (page - 1) * pageSize;
  let whereClause = 'WHERE user_id = ?';
  const params = [userId];

  if (status) {
    whereClause += ' AND status = ?';
    params.push(status);
  }

  const orders = await allQuery(`
    SELECT * FROM orders
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `, [...params, parseInt(pageSize), offset]);

  const countResult = await getQuery(`
    SELECT COUNT(*) as total FROM orders ${whereClause}
  `, params);

  for (const order of orders) {
    order.items = await allQuery(`
      SELECT * FROM order_items WHERE order_id = ?
    `, [order.id]);
  }

  ctx.body = {
    success: true,
    data: {
      orders,
      total: countResult.total,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    }
  };
});

router.get('/:id', authMiddleware, async (ctx) => {
  const userId = ctx.state.user.id;
  const { id } = ctx.params;

  const order = await getQuery(`
    SELECT * FROM orders WHERE id = ? AND user_id = ?
  `, [id, userId]);

  if (!order) {
    ctx.status = 404;
    ctx.body = { success: false, message: '订单不存在' };
    return;
  }

  order.items = await allQuery(`
    SELECT * FROM order_items WHERE order_id = ?
  `, [id]);

  ctx.body = {
    success: true,
    data: order
  };
});

router.post('/create', authMiddleware, async (ctx) => {
  const userId = ctx.state.user.id;
  const { shipping_address, payment_method = 'cod', remark = '' } = ctx.request.body;

  const cartItems = await allQuery(`
    SELECT 
      c.*,
      p.name,
      p.price,
      p.stock,
      p.image
    FROM carts c
    INNER JOIN products p ON c.product_id = p.id
    WHERE c.user_id = ?
    ORDER BY c.created_at DESC
  `, [userId]);

  if (cartItems.length === 0) {
    ctx.status = 400;
    ctx.body = { success: false, message: '购物车是空的' };
    return;
  }

  for (const item of cartItems) {
    if (item.quantity > item.stock) {
      ctx.status = 400;
      ctx.body = { success: false, message: `商品 "${item.name}" 库存不足，仅剩 ${item.stock} 件` };
      return;
    }
  }

  const orderNo = generateOrderNo();
  const totalAmount = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const result = await runQuery(`
    INSERT INTO orders (user_id, order_no, total_amount, status, shipping_address, payment_method, remark)
    VALUES (?, ?, ?, 'pending', ?, ?, ?)
  `, [userId, orderNo, totalAmount, shipping_address, payment_method, remark]);

  const orderId = result.lastInsertRowid;

  for (const item of cartItems) {
    const subtotal = item.price * item.quantity;
    await runQuery(`
      INSERT INTO order_items (order_id, product_id, product_name, product_price, quantity, subtotal, product_image)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [orderId, item.product_id, item.name, item.price, item.quantity, subtotal, item.image]);

    await runQuery(`
      UPDATE products SET stock = stock - ? WHERE id = ?
    `, [item.quantity, item.product_id]);
  }

  await runQuery('DELETE FROM carts WHERE user_id = ?', [userId]);

  const order = await getQuery('SELECT * FROM orders WHERE id = ?', [orderId]);
  order.items = await allQuery('SELECT * FROM order_items WHERE order_id = ?', [orderId]);

  ctx.body = {
    success: true,
    message: '订单创建成功',
    data: order
  };
});

router.put('/:id/cancel', authMiddleware, async (ctx) => {
  const userId = ctx.state.user.id;
  const { id } = ctx.params;

  const order = await getQuery(`
    SELECT * FROM orders WHERE id = ? AND user_id = ?
  `, [id, userId]);

  if (!order) {
    ctx.status = 404;
    ctx.body = { success: false, message: '订单不存在' };
    return;
  }

  if (order.status !== 'pending') {
    ctx.status = 400;
    ctx.body = { success: false, message: '该订单状态不允许取消' };
    return;
  }

  const orderItems = await allQuery(`
    SELECT * FROM order_items WHERE order_id = ?
  `, [id]);

  for (const item of orderItems) {
    await runQuery(`
      UPDATE products SET stock = stock + ? WHERE id = ?
    `, [item.quantity, item.product_id]);
  }

  await runQuery(`
    UPDATE orders SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `, [id]);

  ctx.body = {
    success: true,
    message: '订单已取消'
  };
});

router.put('/:id/status', authMiddleware, async (ctx) => {
  const userId = ctx.state.user.id;
  const { id } = ctx.params;
  const { status } = ctx.request.body;

  const validStatuses = ['pending', 'paid', 'shipped', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    ctx.status = 400;
    ctx.body = { success: false, message: '无效的订单状态' };
    return;
  }

  const order = await getQuery(`
    SELECT * FROM orders WHERE id = ? AND user_id = ?
  `, [id, userId]);

  if (!order) {
    ctx.status = 404;
    ctx.body = { success: false, message: '订单不存在' };
    return;
  }

  await runQuery(`
    UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `, [status, id]);

  ctx.body = {
    success: true,
    message: '订单状态已更新'
  };
});

module.exports = router;
