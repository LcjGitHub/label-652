import Router from 'koa-router';
import { runQuery, getQuery, allQuery } from '../database.js';
import { authMiddleware } from '../middleware/auth.js';

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

const rollbackStock = async (orderId) => {
  const orderItems = await allQuery(`
    SELECT * FROM order_items WHERE order_id = ?
  `, [orderId]);

  for (const item of orderItems) {
    if (item.sku_id) {
      await runQuery(`
        UPDATE product_skus SET stock = stock + ? WHERE id = ?
      `, [item.quantity, item.sku_id]);
    } else {
      await runQuery(`
        UPDATE products SET stock = stock + ? WHERE id = ?
      `, [item.quantity, item.product_id]);
    }
  }
};

router.post('/create', authMiddleware, async (ctx) => {
  const userId = ctx.state.user.id;
  const { shipping_address, payment_method = 'cod', remark = '' } = ctx.request.body;

  if (!shipping_address || shipping_address.trim() === '') {
    ctx.status = 400;
    ctx.body = { success: false, message: '收货地址不能为空' };
    return;
  }

  const cartItems = await allQuery(`
    SELECT 
      c.*,
      p.name,
      p.price as product_price,
      p.stock as product_stock,
      p.image,
      p.has_multi_spec,
      sk.id as sku_key,
      sk.price as sku_price,
      sk.stock as sku_stock,
      sk.spec_text
    FROM carts c
    INNER JOIN products p ON c.product_id = p.id
    LEFT JOIN product_skus sk ON c.sku_id = sk.id
    WHERE c.user_id = ?
    ORDER BY c.created_at DESC
  `, [userId]);

  if (cartItems.length === 0) {
    ctx.status = 400;
    ctx.body = { success: false, message: '购物车是空的' };
    return;
  }

  for (const item of cartItems) {
    const hasSku = item.sku_id != null;
    const effectivePrice = hasSku ? item.sku_price : item.product_price;
    const effectiveStock = hasSku ? item.sku_stock : item.product_stock;

    if (hasSku && !item.sku_key) {
      ctx.status = 400;
      ctx.body = { success: false, message: `商品 "${item.name}" 的规格已失效，请重新选择` };
      return;
    }
    if (item.quantity > effectiveStock) {
      ctx.status = 400;
      ctx.body = { success: false, message: `商品 "${item.name}" ${hasSku ? '(' + (item.spec_text || '') + ')' : ''} 库存不足，仅剩 ${effectiveStock} 件` };
      return;
    }
    item._effectivePrice = effectivePrice;
    item._effectiveStock = effectiveStock;
  }

  const orderNo = generateOrderNo();
  const totalAmount = cartItems.reduce((sum, item) => sum + item._effectivePrice * item.quantity, 0);

  const result = await runQuery(`
    INSERT INTO orders (user_id, order_no, total_amount, status, shipping_address, payment_method, remark)
    VALUES (?, ?, ?, 'pending', ?, ?, ?)
  `, [userId, orderNo, totalAmount, shipping_address, payment_method, remark]);

  const orderId = result.lastID;

  for (const item of cartItems) {
    const hasSku = item.sku_id != null;
    const subtotal = item._effectivePrice * item.quantity;
    const skuName = hasSku ? (item.sku_name || item.spec_text || '') : '';

    await runQuery(`
      INSERT INTO order_items (order_id, product_id, product_name, product_price, quantity, subtotal, product_image, sku_id, sku_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [orderId, item.product_id, item.name, item._effectivePrice, item.quantity, subtotal, item.image, hasSku ? item.sku_id : null, skuName || null]);

    if (hasSku) {
      await runQuery(`
        UPDATE product_skus SET stock = stock - ? WHERE id = ?
      `, [item.quantity, item.sku_id]);
    } else {
      await runQuery(`
        UPDATE products SET stock = stock - ? WHERE id = ?
      `, [item.quantity, item.product_id]);
    }
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

  if (order.status !== 'pending' && order.status !== 'paid') {
    ctx.status = 400;
    ctx.body = { success: false, message: '该订单状态不允许取消' };
    return;
  }

  await rollbackStock(id);

  await runQuery(`
    UPDATE orders SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `, [id]);

  ctx.body = {
    success: true,
    message: '订单已取消'
  };
});

const statusTransitions = {
  pending: ['paid', 'cancelled'],
  paid: ['shipped', 'cancelled'],
  shipped: ['completed'],
  completed: [],
  cancelled: []
};

const checkStatusTransition = (currentStatus, newStatus) => {
  const allowedTransitions = statusTransitions[currentStatus] || [];
  return allowedTransitions.includes(newStatus);
};

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

  if (!checkStatusTransition(order.status, status)) {
    ctx.status = 400;
    const statusTextMap = {
      pending: '待支付',
      paid: '待发货',
      shipped: '待收货',
      completed: '已完成',
      cancelled: '已取消'
    };
    ctx.body = {
      success: false,
      message: `订单状态不允许从"${statusTextMap[order.status]}"变更为"${statusTextMap[status]}"`
    };
    return;
  }

  if (status === 'cancelled') {
    await rollbackStock(id);
  }

  await runQuery(`
    UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `, [status, id]);

  if (status === 'paid') {
    setTimeout(async () => {
      try {
        await runQuery(`
          UPDATE orders SET status = 'shipped', updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `, [id]);
        console.log(`订单 ${id} 已自动发货`);
      } catch (err) {
        console.error('自动发货失败:', err);
      }
    }, 3000);
  }

  ctx.body = {
    success: true,
    message: '订单状态已更新'
  };
});

export default router;
