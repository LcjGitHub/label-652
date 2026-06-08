import Router from 'koa-router';
import {
  runQuery,
  getQuery,
  allQuery,
  getProductActivePromotion,
  calculatePromotionPrice,
  calculateCouponDiscount,
  calculateCartPromotions,
  getPromotionDisplayText
} from '../database.js';
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
  const { shipping_address, payment_method = 'cod', remark = '', user_coupon_id = null } = ctx.request.body;

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

    if (item.has_multi_spec === 1 && !hasSku) {
      ctx.status = 400;
      ctx.body = { success: false, message: `商品 "${item.name}" 是多规格商品，请先选择规格再下单` };
      return;
    }

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

  const originalTotal = cartItems.reduce((sum, item) => sum + item._effectivePrice * item.quantity, 0);

  const promotionResult = await calculateCartPromotions(cartItems);
  const promotionDiscount = promotionResult.totalPromotionDiscount;

  let couponDiscount = 0;
  let couponId = null;

  if (user_coupon_id) {
    const userCoupon = await getQuery(`
      SELECT uc.*, c.name, c.type, c.value, c.min_amount, c.start_time, c.end_time, c.status as coupon_status
      FROM user_coupons uc
      INNER JOIN coupons c ON uc.coupon_id = c.id
      WHERE uc.id = ? AND uc.user_id = ?
    `, [user_coupon_id, userId]);

    if (!userCoupon) {
      ctx.status = 400;
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

    const amountAfterPromotion = originalTotal - promotionDiscount;
    const couponData = {
      type: userCoupon.type,
      value: userCoupon.value,
      min_amount: userCoupon.min_amount
    };
    const couponValidation = calculateCouponDiscount(couponData, amountAfterPromotion);

    if (!couponValidation.valid) {
      ctx.status = 400;
      ctx.body = { success: false, message: couponValidation.reason || '优惠券不可用' };
      return;
    }

    couponDiscount = couponValidation.discount;
    couponId = userCoupon.coupon_id;
  }

  const totalDiscount = promotionDiscount + couponDiscount;
  const totalAmount = Math.max(0, Math.round((originalTotal - totalDiscount) * 100) / 100);

  const orderNo = generateOrderNo();
  const result = await runQuery(`
    INSERT INTO orders (user_id, order_no, total_amount, status, shipping_address, payment_method, remark, discount_amount, coupon_id, promotion_discount, coupon_discount)
    VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?)
  `, [userId, orderNo, totalAmount, shipping_address, payment_method, remark, totalDiscount, couponId, promotionDiscount, couponDiscount]);

  const orderId = result.lastID;

  for (const item of cartItems) {
    const hasSku = item.sku_id != null;
    const itemPromo = promotionResult.itemPromotions.find(
      p => p.product_id === item.product_id && p.sku_id === (item.sku_id || null)
    );
    const finalPrice = itemPromo ? Math.round((itemPromo.finalSubtotal / item.quantity) * 100) / 100 : item._effectivePrice;
    const subtotal = itemPromo ? itemPromo.finalSubtotal : item._effectivePrice * item.quantity;
    const skuName = hasSku ? (item.sku_name || item.spec_text || '') : '';

    await runQuery(`
      INSERT INTO order_items (order_id, product_id, product_name, product_price, quantity, subtotal, product_image, sku_id, sku_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [orderId, item.product_id, item.name, finalPrice, item.quantity, subtotal, item.image, hasSku ? item.sku_id : null, skuName || null]);

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

  if (user_coupon_id) {
    await runQuery(`
      UPDATE user_coupons SET status = 'used', used_order_id = ?, used_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `, [orderId, user_coupon_id, userId]);

    await runQuery(`
      UPDATE coupons SET used_count = used_count + 1 WHERE id = ?
    `, [couponId]);
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

router.post('/calculate', authMiddleware, async (ctx) => {
  const userId = ctx.state.user.id;
  const { user_coupon_id = null } = ctx.request.body;

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
    ctx.body = {
      success: true,
      data: {
        original_total: 0,
        promotion_discount: 0,
        coupon_discount: 0,
        total_discount: 0,
        final_total: 0,
        item_details: []
      }
    };
    return;
  }

  for (const item of cartItems) {
    const hasSku = item.sku_id != null;
    item._effectivePrice = hasSku ? item.sku_price : item.product_price;
    const promotion = await getProductActivePromotion(item.product_id);
    item._promotion = promotion ? {
      id: promotion.id,
      name: promotion.name,
      type: promotion.type,
      display_text: getPromotionDisplayText(promotion),
      price: calculatePromotionPrice(promotion, item._effectivePrice, 1)
    } : null;
  }

  const originalTotal = cartItems.reduce((sum, item) => sum + item._effectivePrice * item.quantity, 0);

  const promotionResult = await calculateCartPromotions(cartItems);
  const promotionDiscount = promotionResult.totalPromotionDiscount;

  let couponDiscount = 0;
  let couponInfo = null;

  if (user_coupon_id) {
    const userCoupon = await getQuery(`
      SELECT uc.*, c.name, c.type, c.value, c.min_amount, c.start_time, c.end_time, c.status as coupon_status
      FROM user_coupons uc
      INNER JOIN coupons c ON uc.coupon_id = c.id
      WHERE uc.id = ? AND uc.user_id = ?
    `, [user_coupon_id, userId]);

    if (userCoupon && userCoupon.status === 'unused' && userCoupon.coupon_status === 1) {
      const now = new Date().toISOString();
      if (userCoupon.end_time >= now) {
        const amountAfterPromotion = originalTotal - promotionDiscount;
        const couponData = {
          type: userCoupon.type,
          value: userCoupon.value,
          min_amount: userCoupon.min_amount
        };
        const couponValidation = calculateCouponDiscount(couponData, amountAfterPromotion);
        if (couponValidation.valid) {
          couponDiscount = couponValidation.discount;
          couponInfo = {
            id: userCoupon.id,
            name: userCoupon.name,
            discount: couponDiscount
          };
        }
      }
    }
  }

  const totalDiscount = promotionDiscount + couponDiscount;
  const finalTotal = Math.max(0, Math.round((originalTotal - totalDiscount) * 100) / 100);

  ctx.body = {
    success: true,
    data: {
      original_total: originalTotal,
      promotion_discount: promotionDiscount,
      coupon_discount: couponDiscount,
      total_discount: totalDiscount,
      final_total: finalTotal,
      item_details: cartItems.map(item => {
        const promoDetail = promotionResult.itemPromotions.find(
          p => p.product_id === item.product_id && p.sku_id === (item.sku_id || null)
        );
        return {
          cart_id: item.id,
          product_id: item.product_id,
          sku_id: item.sku_id || null,
          name: item.name,
          image: item.image,
          sku_name: item.sku_name || null,
          price: item._effectivePrice,
          quantity: item.quantity,
          subtotal: item._effectivePrice * item.quantity,
          promotion: item._promotion,
          promotion_discount: promoDetail ? promoDetail.promotionDiscount : 0,
          final_subtotal: promoDetail ? promoDetail.finalSubtotal : item._effectivePrice * item.quantity
        };
      }),
      selected_coupon: couponInfo
    }
  };
});

router.get('/my/available-coupons', authMiddleware, async (ctx) => {
  const userId = ctx.state.user.id;
  const { total_amount = 0 } = ctx.query;

  const userCoupons = await allQuery(`
    SELECT uc.*, c.name, c.type, c.value, c.min_amount, c.description, c.start_time, c.end_time
    FROM user_coupons uc
    INNER JOIN coupons c ON uc.coupon_id = c.id
    WHERE uc.user_id = ? AND uc.status = 'unused' AND c.status = 1
    ORDER BY uc.received_at DESC
  `, [userId]);

  const now = new Date().toISOString();
  const validCoupons = [];
  const invalidCoupons = [];

  for (const uc of userCoupons) {
    if (uc.end_time < now) {
      invalidCoupons.push({ ...uc, reason: '已过期', available: false });
      continue;
    }

    const couponData = {
      type: uc.type,
      value: uc.value,
      min_amount: uc.min_amount
    };
    const validation = calculateCouponDiscount(couponData, parseFloat(total_amount) || 0);

    const displayText = uc.type === 'fixed' ? `¥${uc.value}` : `${Math.round(uc.value * 10)}折`;

    if (validation.valid) {
      validCoupons.push({
        ...uc,
        display_text: displayText,
        discount: validation.discount,
        available: true
      });
    } else {
      invalidCoupons.push({
        ...uc,
        display_text: displayText,
        reason: validation.reason || '不可用',
        available: false
      });
    }
  }

  ctx.body = {
    success: true,
    data: {
      available: validCoupons,
      unavailable: invalidCoupons
    }
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
