import Router from 'koa-router';
import ExcelJS from 'exceljs';
import { runQuery, getQuery, allQuery, getProductStock } from '../database.js';
import { authMiddleware } from '../middleware/auth.js';

const router = new Router({ prefix: '/api/stock-alerts' });

async function getGlobalConfig() {
  let config = await getQuery('SELECT * FROM stock_alert_global_config ORDER BY id DESC LIMIT 1');
  if (!config) {
    await runQuery(`
      INSERT INTO stock_alert_global_config (default_threshold, enabled, notify_email)
      VALUES (20, 1, 'admin@example.com')
    `);
    config = await getQuery('SELECT * FROM stock_alert_global_config ORDER BY id DESC LIMIT 1');
  }
  return config;
}

async function getProductThreshold(productId) {
  const config = await getQuery(
    'SELECT threshold, enabled FROM stock_alert_config WHERE product_id = ?',
    [productId]
  );
  const globalConfig = await getGlobalConfig();
  if (config) {
    return {
      threshold: config.threshold,
      enabled: config.enabled === 1,
      source: 'product'
    };
  }
  return {
    threshold: globalConfig.default_threshold,
    enabled: globalConfig.enabled === 1,
    source: 'global'
  };
}

router.get('/global-config', authMiddleware, async (ctx) => {
  const config = await getGlobalConfig();
  ctx.body = {
    success: true,
    data: {
      default_threshold: config.default_threshold,
      enabled: config.enabled === 1,
      notify_email: config.notify_email
    }
  };
});

router.put('/global-config', authMiddleware, async (ctx) => {
  const { default_threshold, enabled, notify_email } = ctx.request.body;

  if (default_threshold !== undefined && (isNaN(default_threshold) || default_threshold < 0)) {
    ctx.status = 400;
    ctx.body = { success: false, message: '默认阈值必须为非负整数' };
    return;
  }

  const existing = await getQuery('SELECT * FROM stock_alert_global_config ORDER BY id DESC LIMIT 1');

  if (existing) {
    const updateFields = [];
    const updateValues = [];

    if (default_threshold !== undefined) {
      updateFields.push('default_threshold = ?');
      updateValues.push(default_threshold);
    }
    if (enabled !== undefined) {
      updateFields.push('enabled = ?');
      updateValues.push(enabled ? 1 : 0);
    }
    if (notify_email !== undefined) {
      updateFields.push('notify_email = ?');
      updateValues.push(notify_email);
    }
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(existing.id);

    await runQuery(`
      UPDATE stock_alert_global_config SET ${updateFields.join(', ')}
      WHERE id = ?
    `, updateValues);
  } else {
    await runQuery(`
      INSERT INTO stock_alert_global_config (default_threshold, enabled, notify_email)
      VALUES (?, ?, ?)
    `, [
      default_threshold !== undefined ? default_threshold : 20,
      enabled !== undefined ? (enabled ? 1 : 0) : 1,
      notify_email || 'admin@example.com'
    ]);
  }

  const updated = await getGlobalConfig();
  ctx.body = {
    success: true,
    data: {
      default_threshold: updated.default_threshold,
      enabled: updated.enabled === 1,
      notify_email: updated.notify_email
    },
    message: '全局预警配置更新成功'
  };
});

router.get('/product-config', authMiddleware, async (ctx) => {
  const { product_id } = ctx.query;

  if (product_id) {
    const config = await getQuery(
      'SELECT * FROM stock_alert_config WHERE product_id = ?',
      [product_id]
    );
    const product = await getQuery('SELECT name FROM products WHERE id = ?', [product_id]);
    const threshold = await getProductThreshold(product_id);

    ctx.body = {
      success: true,
      data: config ? {
        ...config,
        enabled: config.enabled === 1,
        product_name: product?.name,
        effective_threshold: threshold.threshold
      } : {
        product_id: parseInt(product_id),
        product_name: product?.name,
        threshold: null,
        enabled: true,
        effective_threshold: threshold.threshold,
        uses_global: true
      }
    };
    return;
  }

  const configs = await allQuery(`
    SELECT sac.*, p.name as product_name, p.stock, p.category
    FROM stock_alert_config sac
    LEFT JOIN products p ON sac.product_id = p.id
    ORDER BY sac.updated_at DESC
  `);

  ctx.body = {
    success: true,
    data: configs.map(c => ({
      ...c,
      enabled: c.enabled === 1
    }))
  };
});

router.put('/product-config/:productId', authMiddleware, async (ctx) => {
  const { productId } = ctx.params;
  const { threshold, enabled } = ctx.request.body;

  const product = await getQuery('SELECT * FROM products WHERE id = ?', [productId]);
  if (!product) {
    ctx.status = 404;
    ctx.body = { success: false, message: '商品不存在' };
    return;
  }

  if (threshold !== undefined && (isNaN(threshold) || threshold < 0)) {
    ctx.status = 400;
    ctx.body = { success: false, message: '阈值必须为非负整数' };
    return;
  }

  const existing = await getQuery(
    'SELECT * FROM stock_alert_config WHERE product_id = ?',
    [productId]
  );

  if (existing) {
    const updateFields = [];
    const updateValues = [];

    if (threshold !== undefined) {
      updateFields.push('threshold = ?');
      updateValues.push(threshold);
    }
    if (enabled !== undefined) {
      updateFields.push('enabled = ?');
      updateValues.push(enabled ? 1 : 0);
    }
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(productId);

    await runQuery(`
      UPDATE stock_alert_config SET ${updateFields.join(', ')}
      WHERE product_id = ?
    `, updateValues);
  } else {
    await runQuery(`
      INSERT INTO stock_alert_config (product_id, threshold, enabled)
      VALUES (?, ?, ?)
    `, [
      productId,
      threshold !== undefined ? threshold : 10,
      enabled !== undefined ? (enabled ? 1 : 0) : 1
    ]);
  }

  const updated = await getQuery(
    'SELECT * FROM stock_alert_config WHERE product_id = ?',
    [productId]
  );

  ctx.body = {
    success: true,
    data: {
      ...updated,
      enabled: updated.enabled === 1
    },
    message: '商品预警配置更新成功'
  };
});

router.delete('/product-config/:productId', authMiddleware, async (ctx) => {
  const { productId } = ctx.params;

  const existing = await getQuery(
    'SELECT * FROM stock_alert_config WHERE product_id = ?',
    [productId]
  );
  if (!existing) {
    ctx.status = 404;
    ctx.body = { success: false, message: '该商品没有自定义预警配置' };
    return;
  }

  await runQuery('DELETE FROM stock_alert_config WHERE product_id = ?', [productId]);
  ctx.body = { success: true, message: '已删除自定义配置，将使用全局默认阈值' };
});

router.get('/alert-products', authMiddleware, async (ctx) => {
  const globalConfig = await getGlobalConfig();

  const products = await allQuery(`
    SELECT 
      p.*,
      CASE WHEN p.has_multi_spec = 1 THEN COALESCE(sku_total.total_stock, 0) ELSE p.stock END as effective_stock,
      COALESCE(sac.threshold, ?) as alert_threshold,
      COALESCE(sac.enabled, ?) as alert_enabled
    FROM products p
    LEFT JOIN stock_alert_config sac ON p.id = sac.product_id
    LEFT JOIN (
      SELECT product_id, SUM(stock) as total_stock
      FROM product_skus
      GROUP BY product_id
    ) sku_total ON p.id = sku_total.product_id
    WHERE (CASE WHEN p.has_multi_spec = 1 THEN COALESCE(sku_total.total_stock, 0) ELSE p.stock END) < COALESCE(sac.threshold, ?)
      AND COALESCE(sac.enabled, ?) = 1
      AND ? = 1
    ORDER BY effective_stock ASC
  `, [
    globalConfig.default_threshold,
    globalConfig.enabled,
    globalConfig.default_threshold,
    globalConfig.enabled,
    globalConfig.enabled
  ]);

  const data = products.map(p => ({
    ...p,
    stock: p.effective_stock,
    alert_enabled: p.alert_enabled === 1,
    is_alert: true,
    shortage: p.alert_threshold - p.effective_stock
  }));

  ctx.body = {
    success: true,
    data: {
      products: data,
      total: data.length
    }
  };
});

router.get('/alert-count', async (ctx) => {
  const globalConfig = await getGlobalConfig();
  if (globalConfig.enabled !== 1) {
    ctx.body = { success: true, data: { count: 0, enabled: false } };
    return;
  }

  const result = await getQuery(`
    SELECT COUNT(*) as count
    FROM products p
    LEFT JOIN stock_alert_config sac ON p.id = sac.product_id
    LEFT JOIN (
      SELECT product_id, SUM(stock) as total_stock
      FROM product_skus
      GROUP BY product_id
    ) sku_total ON p.id = sku_total.product_id
    WHERE (CASE WHEN p.has_multi_spec = 1 THEN COALESCE(sku_total.total_stock, 0) ELSE p.stock END) < COALESCE(sac.threshold, ?)
      AND COALESCE(sac.enabled, 1) = 1
  `, [globalConfig.default_threshold]);

  ctx.body = {
    success: true,
    data: {
      count: result.count,
      enabled: true
    }
  };
});

function generateOrderNo() {
  const now = new Date();
  const timestamp = now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `RS${timestamp}${random}`;
}

router.post('/restock-order', authMiddleware, async (ctx) => {
  const { product_ids, remark, multiplier = 2 } = ctx.request.body;

  const globalConfig = await getGlobalConfig();

  let productsToRestock;
  if (product_ids && product_ids.length > 0) {
    const placeholders = product_ids.map(() => '?').join(',');
    productsToRestock = await allQuery(`
      SELECT 
        p.*,
        CASE WHEN p.has_multi_spec = 1 THEN COALESCE(sku_total.total_stock, 0) ELSE p.stock END as effective_stock,
        COALESCE(sac.threshold, ?) as alert_threshold
      FROM products p
      LEFT JOIN stock_alert_config sac ON p.id = sac.product_id
      LEFT JOIN (
        SELECT product_id, SUM(stock) as total_stock
        FROM product_skus
        GROUP BY product_id
      ) sku_total ON p.id = sku_total.product_id
      WHERE p.id IN (${placeholders})
    `, [globalConfig.default_threshold, ...product_ids]);
  } else {
    productsToRestock = await allQuery(`
      SELECT 
        p.*,
        CASE WHEN p.has_multi_spec = 1 THEN COALESCE(sku_total.total_stock, 0) ELSE p.stock END as effective_stock,
        COALESCE(sac.threshold, ?) as alert_threshold
      FROM products p
      LEFT JOIN stock_alert_config sac ON p.id = sac.product_id
      LEFT JOIN (
        SELECT product_id, SUM(stock) as total_stock
        FROM product_skus
        GROUP BY product_id
      ) sku_total ON p.id = sku_total.product_id
      WHERE (CASE WHEN p.has_multi_spec = 1 THEN COALESCE(sku_total.total_stock, 0) ELSE p.stock END) < COALESCE(sac.threshold, ?)
        AND COALESCE(sac.enabled, 1) = 1
        AND ? = 1
      ORDER BY effective_stock ASC
    `, [
      globalConfig.default_threshold,
      globalConfig.default_threshold,
      globalConfig.enabled
    ]);
  }

  if (productsToRestock.length === 0) {
    ctx.status = 400;
    ctx.body = { success: false, message: '没有需要补货的商品' };
    return;
  }

  const orderNo = generateOrderNo();
  const orderResult = await runQuery(`
    INSERT INTO restock_orders (order_no, status, total_items, remark)
    VALUES (?, 'pending', ?, ?)
  `, [orderNo, productsToRestock.length, remark || '']);

  const orderId = orderResult.lastID;
  let totalAmount = 0;
  const items = [];

  for (const product of productsToRestock) {
    const currentStock = product.effective_stock !== undefined ? product.effective_stock : product.stock;
    const suggestedQty = Math.max(
      Math.max((product.alert_threshold - currentStock) * multiplier, product.alert_threshold),
      1
    );
    const subtotal = product.price * suggestedQty;
    totalAmount += subtotal;

    await runQuery(`
      INSERT INTO restock_order_items 
      (restock_order_id, product_id, product_name, current_stock, threshold, 
       suggested_quantity, unit_price, subtotal)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      orderId,
      product.id,
      product.name,
      currentStock,
      product.alert_threshold,
      suggestedQty,
      product.price,
      subtotal
    ]);

    items.push({
      product_id: product.id,
      product_name: product.name,
      current_stock: currentStock,
      threshold: product.alert_threshold,
      suggested_quantity: suggestedQty,
      unit_price: product.price,
      subtotal
    });
  }

  ctx.body = {
    success: true,
    data: {
      id: orderId,
      order_no: orderNo,
      status: 'pending',
      total_items: productsToRestock.length,
      total_amount: totalAmount,
      remark: remark || '',
      items,
      created_at: new Date().toISOString()
    },
    message: '补货建议单生成成功'
  };
});

router.get('/restock-order/:id', authMiddleware, async (ctx) => {
  const { id } = ctx.params;

  const order = await getQuery('SELECT * FROM restock_orders WHERE id = ?', [id]);
  if (!order) {
    ctx.status = 404;
    ctx.body = { success: false, message: '补货单不存在' };
    return;
  }

  const items = await allQuery(`
    SELECT * FROM restock_order_items WHERE restock_order_id = ? ORDER BY id ASC
  `, [id]);

  const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);

  ctx.body = {
    success: true,
    data: {
      ...order,
      total_amount: totalAmount,
      items
    }
  };
});

router.get('/restock-order/:id/export', authMiddleware, async (ctx) => {
  const { id } = ctx.params;

  const order = await getQuery('SELECT * FROM restock_orders WHERE id = ?', [id]);
  if (!order) {
    ctx.status = 404;
    ctx.body = { success: false, message: '补货单不存在' };
    return;
  }

  const items = await allQuery(`
    SELECT * FROM restock_order_items WHERE restock_order_id = ? ORDER BY id ASC
  `, [id]);

  const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('补货建议单');

  worksheet.mergeCells('A1:G1');
  const titleRow = worksheet.getCell('A1');
  titleRow.value = `补货建议单 - ${order.order_no}`;
  titleRow.font = { bold: true, size: 18, color: { argb: 'FF667EEA' } };
  titleRow.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(1).height = 40;

  worksheet.mergeCells('A2:G2');
  const infoRow = worksheet.getCell('A2');
  infoRow.value = `生成时间：${new Date(order.created_at).toLocaleString('zh-CN')}    备注：${order.remark || '无'}`;
  infoRow.font = { size: 12, color: { argb: 'FF666666' } };
  infoRow.alignment = { vertical: 'middle', horizontal: 'left' };
  worksheet.getRow(2).height = 25;

  const headers = [
    { key: 'index', header: '序号', width: 8 },
    { key: 'product_name', header: '商品名称', width: 30 },
    { key: 'current_stock', header: '当前库存', width: 12 },
    { key: 'threshold', header: '预警阈值', width: 12 },
    { key: 'suggested_quantity', header: '建议补货量', width: 14 },
    { key: 'unit_price', header: '单价(元)', width: 14 },
    { key: 'subtotal', header: '小计(元)', width: 16 }
  ];

  worksheet.columns = headers;

  const headerRow = worksheet.getRow(4);
  headers.forEach((h, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF667EEA' }
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  worksheet.getRow(4).height = 30;

  items.forEach((item, index) => {
    const row = worksheet.addRow({
      index: index + 1,
      product_name: item.product_name,
      current_stock: item.current_stock,
      threshold: item.threshold,
      suggested_quantity: item.suggested_quantity,
      unit_price: item.unit_price.toFixed(2),
      subtotal: item.subtotal.toFixed(2)
    });

    row.alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };

    if (item.current_stock <= item.threshold * 0.5) {
      row.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFF2F2' }
        };
        cell.font = { color: { argb: 'FFE74C3C' } };
      });
    }
  });

  const totalRow = worksheet.addRow({
    index: '',
    product_name: '合计',
    current_stock: '',
    threshold: '',
    suggested_quantity: items.reduce((sum, i) => sum + i.suggested_quantity, 0),
    unit_price: '',
    subtotal: totalAmount.toFixed(2)
  });
  totalRow.font = { bold: true, size: 12 };
  totalRow.alignment = { vertical: 'middle', horizontal: 'center' };
  totalRow.getCell(2).alignment = { vertical: 'middle', horizontal: 'right' };
  totalRow.getCell(7).font = { bold: true, size: 14, color: { argb: 'FFE74C3C' } };
  totalRow.height = 30;

  const now = new Date();
  const fileName = `补货建议单_${order.order_no}.xlsx`;

  ctx.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  ctx.set('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);

  ctx.body = await workbook.xlsx.writeBuffer();
});

router.post('/restock-order/:id/send-email', authMiddleware, async (ctx) => {
  const { id } = ctx.params;
  const { email } = ctx.request.body;

  const order = await getQuery('SELECT * FROM restock_orders WHERE id = ?', [id]);
  if (!order) {
    ctx.status = 404;
    ctx.body = { success: false, message: '补货单不存在' };
    return;
  }

  const globalConfig = await getGlobalConfig();
  const targetEmail = email || globalConfig.notify_email;

  if (!targetEmail) {
    ctx.status = 400;
    ctx.body = { success: false, message: '请配置接收邮箱地址' };
    return;
  }

  const items = await allQuery(`
    SELECT * FROM restock_order_items WHERE restock_order_id = ? ORDER BY id ASC
  `, [id]);

  const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);

  console.log(`
========================================
📧 模拟发送邮件
收件人: ${targetEmail}
主题: 【库存预警】补货建议单 ${order.order_no}
----------------------------------------
补货单号: ${order.order_no}
生成时间: ${new Date(order.created_at).toLocaleString('zh-CN')}
商品数量: ${items.length} 种
预计总金额: ¥${totalAmount.toFixed(2)}
备注: ${order.remark || '无'}
----------------------------------------
商品明细:
${items.map(i => `  • ${i.product_name}: 当前库存${i.current_stock}, 建议补货${i.suggested_quantity}件, 小计¥${i.subtotal.toFixed(2)}`).join('\n')}
========================================
  `);

  ctx.body = {
    success: true,
    data: {
      sent: true,
      email: targetEmail,
      order_no: order.order_no,
      items_count: items.length,
      total_amount: totalAmount
    },
    message: `邮件已发送至 ${targetEmail}（模拟发送，请查看控制台日志）`
  };
});

router.get('/restock-orders', authMiddleware, async (ctx) => {
  const { page = 1, limit = 10 } = ctx.query;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  const countResult = await getQuery('SELECT COUNT(*) as total FROM restock_orders');
  const total = countResult.total;

  const orders = await allQuery(`
    SELECT * FROM restock_orders
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `, [limitNum, offset]);

  ctx.body = {
    success: true,
    data: {
      orders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    }
  };
});

export { router, getProductThreshold, getGlobalConfig };
