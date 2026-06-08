import Router from 'koa-router';
import { runQuery, getQuery, allQuery, getProductStock } from '../database.js';
import { authMiddleware } from '../middleware/auth.js';

const router = new Router({ prefix: '/api/cart' });

async function buildCartQuery(whereClause, params) {
  return await allQuery(`
    SELECT 
      c.id,
      c.user_id,
      c.product_id,
      c.sku_id,
      c.sku_name,
      c.quantity,
      c.created_at,
      c.updated_at,
      p.name,
      p.description,
      p.price as product_price,
      p.category,
      p.stock as product_stock,
      p.image,
      p.has_multi_spec,
      sk.price as sku_price,
      sk.stock as sku_stock,
      sk.spec_text as sku_spec_text
    FROM carts c
    INNER JOIN products p ON c.product_id = p.id
    LEFT JOIN product_skus sk ON c.sku_id = sk.id
    ${whereClause}
    ORDER BY c.created_at DESC
  `, params);
}

function enrichCartItem(item) {
  const hasSku = item.sku_id != null;
  const price = hasSku ? item.sku_price : item.product_price;
  const stock = hasSku ? item.sku_stock : item.product_stock;
  const skuName = item.sku_name || item.sku_spec_text || '';

  return {
    id: item.id,
    user_id: item.user_id,
    product_id: item.product_id,
    sku_id: item.sku_id,
    sku_name: skuName,
    quantity: item.quantity,
    created_at: item.created_at,
    updated_at: item.updated_at,
    name: item.name,
    description: item.description,
    price: price,
    category: item.category,
    stock: stock,
    image: item.image,
    has_multi_spec: item.has_multi_spec === 1
  };
}

function calculateStats(items) {
  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return { totalCount, totalPrice };
}

router.get('/', authMiddleware, async (ctx) => {
  const userId = ctx.state.user.id;

  const rawItems = await buildCartQuery('WHERE c.user_id = ?', [userId]);
  const cartItems = rawItems.map(enrichCartItem);
  const { totalCount, totalPrice } = calculateStats(cartItems);

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
  const { product_id, sku_id, quantity = 1 } = ctx.request.body;

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

  let sku = null;
  let skuName = '';
  if (sku_id) {
    sku = await getQuery('SELECT * FROM product_skus WHERE id = ? AND product_id = ?', [sku_id, product_id]);
    if (!sku) {
      ctx.status = 404;
      ctx.body = { success: false, message: '规格不存在' };
      return;
    }
    skuName = sku.spec_text || '';
  }

  const currentStock = sku ? sku.stock : product.stock;

  const findWhere = sku_id
    ? 'WHERE user_id = ? AND product_id = ? AND (sku_id = ? OR (sku_id IS NULL AND ? IS NULL))'
    : 'WHERE user_id = ? AND product_id = ? AND sku_id IS NULL';
  const findParams = sku_id ? [userId, product_id, sku_id, sku_id] : [userId, product_id];
  const existingItem = await getQuery('SELECT * FROM carts ' + findWhere, findParams);

  if (existingItem) {
    const newQuantity = existingItem.quantity + qty;
    if (newQuantity > currentStock) {
      ctx.status = 400;
      ctx.body = { success: false, message: `库存不足，最多可添加 ${currentStock} 件` };
      return;
    }
    await runQuery(
      'UPDATE carts SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newQuantity, existingItem.id]
    );
  } else {
    if (qty > currentStock) {
      ctx.status = 400;
      ctx.body = { success: false, message: `库存不足，最多可添加 ${currentStock} 件` };
      return;
    }
    await runQuery(
      'INSERT INTO carts (user_id, product_id, sku_id, sku_name, quantity) VALUES (?, ?, ?, ?, ?)',
      [userId, product_id, sku_id || null, skuName || null, qty]
    );
  }

  const rawItems = await buildCartQuery('WHERE c.user_id = ?', [userId]);
  const cartItems = rawItems.map(enrichCartItem);
  const { totalCount, totalPrice } = calculateStats(cartItems);

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

router.put('/update/:id', authMiddleware, async (ctx) => {
  const userId = ctx.state.user.id;
  const { id } = ctx.params;
  const { quantity } = ctx.request.body;

  const qty = parseInt(quantity);
  if (isNaN(qty) || qty < 1) {
    ctx.status = 400;
    ctx.body = { success: false, message: '商品数量必须大于0' };
    return;
  }

  const existingItem = await getQuery(
    'SELECT * FROM carts WHERE id = ? AND user_id = ?',
    [id, userId]
  );

  if (!existingItem) {
    ctx.status = 404;
    ctx.body = { success: false, message: '购物车中不存在该商品' };
    return;
  }

  const currentStock = await getProductStock(existingItem.product_id, existingItem.sku_id);

  if (qty > currentStock) {
    ctx.status = 400;
    ctx.body = { success: false, message: `库存不足，最多可添加 ${currentStock} 件` };
    return;
  }

  await runQuery(
    'UPDATE carts SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [qty, existingItem.id]
  );

  const rawItems = await buildCartQuery('WHERE c.user_id = ?', [userId]);
  const cartItems = rawItems.map(enrichCartItem);
  const { totalCount, totalPrice } = calculateStats(cartItems);

  ctx.body = {
    success: true,
    data: {
      items: cartItems,
      totalCount,
      totalPrice
    }
  };
});

router.put('/update-product/:productId', authMiddleware, async (ctx) => {
  const userId = ctx.state.user.id;
  const { productId } = ctx.params;
  const { quantity, sku_id } = ctx.request.body;

  const qty = parseInt(quantity);
  if (isNaN(qty) || qty < 1) {
    ctx.status = 400;
    ctx.body = { success: false, message: '商品数量必须大于0' };
    return;
  }

  const findWhere = sku_id
    ? 'WHERE user_id = ? AND product_id = ? AND sku_id = ?'
    : 'WHERE user_id = ? AND product_id = ? AND sku_id IS NULL';
  const findParams = sku_id ? [userId, productId, sku_id] : [userId, productId];
  const existingItem = await getQuery('SELECT * FROM carts ' + findWhere, findParams);

  if (!existingItem) {
    ctx.status = 404;
    ctx.body = { success: false, message: '购物车中不存在该商品' };
    return;
  }

  const currentStock = await getProductStock(productId, sku_id || null);

  if (qty > currentStock) {
    ctx.status = 400;
    ctx.body = { success: false, message: `库存不足，最多可添加 ${currentStock} 件` };
    return;
  }

  await runQuery(
    'UPDATE carts SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [qty, existingItem.id]
  );

  const rawItems = await buildCartQuery('WHERE c.user_id = ?', [userId]);
  const cartItems = rawItems.map(enrichCartItem);
  const { totalCount, totalPrice } = calculateStats(cartItems);

  ctx.body = {
    success: true,
    data: {
      items: cartItems,
      totalCount,
      totalPrice
    }
  };
});

router.delete('/remove/:id', authMiddleware, async (ctx) => {
  const userId = ctx.state.user.id;
  const { id } = ctx.params;

  const existingItem = await getQuery(
    'SELECT * FROM carts WHERE id = ? AND user_id = ?',
    [id, userId]
  );

  if (!existingItem) {
    ctx.status = 404;
    ctx.body = { success: false, message: '购物车中不存在该商品' };
    return;
  }

  await runQuery('DELETE FROM carts WHERE id = ?', [existingItem.id]);

  const rawItems = await buildCartQuery('WHERE c.user_id = ?', [userId]);
  const cartItems = rawItems.map(enrichCartItem);
  const { totalCount, totalPrice } = calculateStats(cartItems);

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

router.delete('/remove-product/:productId', authMiddleware, async (ctx) => {
  const userId = ctx.state.user.id;
  const { productId } = ctx.params;
  const { sku_id } = ctx.request.body || {};

  const findWhere = sku_id
    ? 'WHERE user_id = ? AND product_id = ? AND sku_id = ?'
    : 'WHERE user_id = ? AND product_id = ? AND sku_id IS NULL';
  const findParams = sku_id ? [userId, productId, sku_id] : [userId, productId];
  const existingItem = await getQuery('SELECT * FROM carts ' + findWhere, findParams);

  if (!existingItem) {
    ctx.status = 404;
    ctx.body = { success: false, message: '购物车中不存在该商品' };
    return;
  }

  await runQuery('DELETE FROM carts WHERE id = ?', [existingItem.id]);

  const rawItems = await buildCartQuery('WHERE c.user_id = ?', [userId]);
  const cartItems = rawItems.map(enrichCartItem);
  const { totalCount, totalPrice } = calculateStats(cartItems);

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
    const { product_id, quantity, sku_id } = item;
    const qty = parseInt(quantity);

    if (!product_id || isNaN(qty) || qty < 1) continue;

    const currentStock = await getProductStock(product_id, sku_id || null);
    const product = await getQuery('SELECT * FROM products WHERE id = ?', [product_id]);
    if (!product) continue;

    let skuName = '';
    if (sku_id) {
      const sku = await getQuery('SELECT * FROM product_skus WHERE id = ? AND product_id = ?', [sku_id, product_id]);
      if (sku) skuName = sku.spec_text || '';
    }

    const actualQty = Math.min(qty, currentStock);
    if (actualQty < 1) continue;

    const findWhere = sku_id
      ? 'WHERE user_id = ? AND product_id = ? AND sku_id = ?'
      : 'WHERE user_id = ? AND product_id = ? AND sku_id IS NULL';
    const findParams = sku_id ? [userId, product_id, sku_id] : [userId, product_id];
    const existingItem = await getQuery('SELECT * FROM carts ' + findWhere, findParams);

    if (existingItem) {
      const newQuantity = Math.min(existingItem.quantity + actualQty, currentStock);
      await runQuery(
        'UPDATE carts SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newQuantity, existingItem.id]
      );
    } else {
      await runQuery(
        'INSERT INTO carts (user_id, product_id, sku_id, sku_name, quantity) VALUES (?, ?, ?, ?, ?)',
        [userId, product_id, sku_id || null, skuName || null, actualQty]
      );
    }
  }

  const rawItems = await buildCartQuery('WHERE c.user_id = ?', [userId]);
  const cartItems = rawItems.map(enrichCartItem);
  const { totalCount, totalPrice } = calculateStats(cartItems);

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

export default router;
