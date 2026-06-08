import Router from 'koa-router';
import multer from '@koa/multer';
import ExcelJS from 'exceljs';
import {
  categories,
  runQuery,
  getQuery,
  allQuery,
  getProductSpecs,
  getProductSkus,
  getProductPriceRange,
  getProductStock,
  getProductActivePromotion,
  getPromotionDisplayText,
  calculatePromotionPrice
} from '../database.js';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js';
import { getProductThreshold, getGlobalConfig } from './stockAlerts.js';

const router = new Router({ prefix: '/api/products' });
const upload = multer({ storage: multer.memoryStorage() });

async function enrichProductWithSpecs(product) {
  if (!product) return product;
  const enriched = { ...product };
  enriched.has_multi_spec = product.has_multi_spec === 1;

  if (enriched.has_multi_spec) {
    const priceRange = await getProductPriceRange(product.id);
    enriched.min_price = priceRange.min_price;
    enriched.max_price = priceRange.max_price;
    enriched.total_stock = await getProductStock(product.id);
    enriched.specs = await getProductSpecs(product.id);
    enriched.skus = await getProductSkus(product.id);
    for (const sku of enriched.skus) {
      const specsObj = {};
      if (sku.spec_text) {
        for (const part of sku.spec_text.split(/[;\/]/)) {
          const [k, v] = part.split(':');
          if (k && v) specsObj[k.trim()] = v.trim();
        }
      }
      sku.specs = specsObj;
    }
  } else {
    enriched.min_price = product.price;
    enriched.max_price = product.price;
    enriched.total_stock = product.stock;
    enriched.specs = [];
    enriched.skus = [];
  }
  return enriched;
}

const EXCEL_HEADERS = [
  { key: 'name', header: '商品名称', width: 30, required: true },
  { key: 'description', header: '商品描述', width: 50, required: false },
  { key: 'price', header: '价格', width: 15, required: true },
  { key: 'category', header: '分类', width: 15, required: true },
  { key: 'stock', header: '库存', width: 10, required: false },
  { key: 'image', header: '图片链接', width: 50, required: false }
];

router.get('/', optionalAuthMiddleware, async (ctx) => {
  const { category, page = 1, limit = 10, sortBy = 'created_at' } = ctx.query;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;
  const userId = ctx.state.user ? ctx.state.user.id : null;

  let whereClause = '';
  let params = [];

  if (category && category !== 'all') {
    whereClause = 'WHERE p.category = ?';
    params.push(category);
  }

  const countResult = await getQuery(`SELECT COUNT(*) as total FROM products p ${whereClause}`, params);
  const total = countResult.total;

  const globalConfig = await getGlobalConfig();
  const globalEnabled = globalConfig.enabled === 1;

  let orderByClause = 'p.created_at DESC';
  let joinClause = '';
  let extraSelectFields = '';

  if (sortBy === 'favorited_at' && userId) {
    joinClause = 'LEFT JOIN favorites f ON f.product_id = p.id AND f.user_id = ?';
    orderByClause = 'f.created_at DESC, p.created_at DESC';
    extraSelectFields = ', f.created_at as favorited_at';
    params.unshift(userId);
  }

  const products = await allQuery(`
    SELECT 
      p.*,
      COALESCE(sac.threshold, ?) as alert_threshold,
      COALESCE(sac.enabled, ?) as alert_enabled
      ${extraSelectFields}
    FROM products p
    ${joinClause}
    LEFT JOIN stock_alert_config sac ON p.id = sac.product_id
    ${whereClause}
    ORDER BY ${orderByClause}
    LIMIT ? OFFSET ?
  `, [globalConfig.default_threshold, globalConfig.enabled, ...params, limitNum, offset]);

  const productsWithAlert = [];
  for (const p of products) {
    const enriched = await enrichProductWithSpecs(p);
    const displayStock = enriched.has_multi_spec ? enriched.total_stock : p.stock;
    const alertEnabled = p.alert_enabled === 1 && globalEnabled;
    const isAlert = alertEnabled && displayStock < p.alert_threshold;

    const promotion = await getProductActivePromotion(p.id);
    const promotionData = promotion ? {
      id: promotion.id,
      name: promotion.name,
      type: promotion.type,
      display_text: getPromotionDisplayText(promotion),
      price: calculatePromotionPrice(promotion, p.price, 1)
    } : null;

    productsWithAlert.push({
      id: enriched.id,
      name: enriched.name,
      description: enriched.description,
      price: enriched.price,
      category: enriched.category,
      stock: displayStock,
      image: enriched.image,
      has_multi_spec: enriched.has_multi_spec,
      min_price: enriched.min_price,
      max_price: enriched.max_price,
      total_stock: enriched.total_stock,
      specs: enriched.has_multi_spec ? enriched.specs : undefined,
      skus: enriched.has_multi_spec ? enriched.skus : undefined,
      created_at: enriched.created_at,
      updated_at: enriched.updated_at,
      alert_threshold: p.alert_threshold,
      alert_enabled: alertEnabled,
      is_alert: isAlert,
      favorited_at: p.favorited_at,
      promotion: promotionData
    });
  }

  ctx.body = {
    success: true,
    data: {
      products: productsWithAlert,
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

router.get('/export', authMiddleware, async (ctx) => {
  const { category } = ctx.query;

  let whereClause = '';
  let params = [];

  if (category && category !== 'all') {
    whereClause = 'WHERE category = ?';
    params.push(category);
  }

  const products = await allQuery(`
    SELECT name, description, price, category, stock, image
    FROM products ${whereClause}
    ORDER BY created_at DESC
  `, params);

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('商品列表');

  worksheet.columns = EXCEL_HEADERS.map(h => ({
    header: h.header,
    key: h.key,
    width: h.width
  }));

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, size: 12 };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8EEFB' }
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  products.forEach(product => {
    worksheet.addRow({
      name: product.name,
      description: product.description || '',
      price: product.price,
      category: product.category,
      stock: product.stock || 0,
      image: product.image || ''
    });
  });

  const now = new Date();
  const fileName = `商品列表_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}.xlsx`;

  ctx.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  ctx.set('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);

  ctx.body = await workbook.xlsx.writeBuffer();
});

router.get('/template', authMiddleware, async (ctx) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('商品导入模板');

  worksheet.columns = EXCEL_HEADERS.map(h => ({
    header: h.header + (h.required ? ' *' : ''),
    key: h.key,
    width: h.width
  }));

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, size: 12 };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8EEFB' }
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  const exampleRow = worksheet.addRow({
    name: '示例商品：iPhone 15',
    description: '最新款苹果手机，搭载 A17 芯片',
    price: 6999.00,
    category: '电子产品',
    stock: 50,
    image: 'https://example.com/image.jpg'
  });
  exampleRow.font = { color: { argb: 'FF999999' }, italic: true };

  worksheet.addRow([]);

  const tipRow = worksheet.addRow({
    name: '说明：',
    description: `必填字段标有 *；分类可选值：${categories.join('、')}；价格必须为数字；库存必须为整数`,
    price: '',
    category: '',
    stock: '',
    image: ''
  });
  tipRow.font = { color: { argb: 'FFE74C3C' }, bold: true };

  const fileName = '商品导入模板.xlsx';

  ctx.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  ctx.set('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);

  ctx.body = await workbook.xlsx.writeBuffer();
});

router.post('/import', authMiddleware, upload.single('file'), async (ctx) => {
  if (!ctx.file) {
    ctx.status = 400;
    ctx.body = { success: false, message: '请上传 Excel 文件' };
    return;
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(ctx.file.buffer);
  } catch (err) {
    ctx.status = 400;
    ctx.body = { success: false, message: '文件解析失败，请确保上传的是有效的 Excel 文件' };
    return;
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    ctx.status = 400;
    ctx.body = { success: false, message: 'Excel 文件中没有工作表' };
    return;
  }

  const rows = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const data = {};
    EXCEL_HEADERS.forEach((h, index) => {
      const cellValue = row.getCell(index + 1).value;
      data[h.key] = cellValue && typeof cellValue === 'object' && cellValue.text !== undefined
        ? cellValue.text
        : cellValue;
    });

    const nameStr = data.name === null || data.name === undefined ? '' : String(data.name).trim();

    if (!nameStr) return;

    if (nameStr.includes('示例')) return;

    if (nameStr.includes('说明')) return;

    const hasAnyValue = Object.values(data).some(v =>
      v !== null && v !== undefined && String(v).trim() !== ''
    );
    if (!hasAnyValue) return;

    rows.push({ rowNumber, data });
  });

  if (rows.length === 0) {
    ctx.status = 400;
    ctx.body = { success: false, message: 'Excel 文件中没有有效商品数据，请填写后再上传' };
    return;
  }

  const errors = [];
  const validProducts = [];
  let successCount = 0;
  let failCount = 0;

  for (const { rowNumber, data } of rows) {
    const rowErrors = [];

    let name = data.name;
    if (name === null || name === undefined || String(name).trim() === '') {
      rowErrors.push('商品名称为必填项');
    } else {
      name = String(name).trim();
    }

    let description = data.description;
    if (description !== null && description !== undefined) {
      description = String(description).trim();
    } else {
      description = '';
    }

    let price = data.price;
    if (price === null || price === undefined || price === '') {
      rowErrors.push('价格为必填项');
    } else {
      price = parseFloat(price);
      if (isNaN(price) || price < 0) {
        rowErrors.push('价格必须为非负数字');
      }
    }

    let category = data.category;
    if (category === null || category === undefined || String(category).trim() === '') {
      rowErrors.push('分类为必填项');
    } else {
      category = String(category).trim();
      if (!categories.includes(category)) {
        rowErrors.push(`分类必须是以下之一：${categories.join('、')}`);
      }
    }

    let stock = data.stock;
    if (stock === null || stock === undefined || stock === '') {
      stock = 0;
    } else {
      stock = parseInt(stock, 10);
      if (isNaN(stock) || stock < 0) {
        rowErrors.push('库存必须为非负整数');
      }
    }

    let image = data.image;
    if (image !== null && image !== undefined) {
      image = String(image).trim();
    } else {
      image = '';
    }

    if (rowErrors.length > 0) {
      failCount++;
      errors.push({
        row: rowNumber,
        errors: rowErrors,
        data: { name, description, price, category, stock, image }
      });
    } else {
      validProducts.push({ name, description, price, category, stock, image });
    }
  }

  for (const product of validProducts) {
    try {
      await runQuery(`
        INSERT INTO products (name, description, price, category, stock, image)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [product.name, product.description, product.price, product.category, product.stock, product.image]);
      successCount++;
    } catch (err) {
      failCount++;
      errors.push({
        row: null,
        errors: [`数据库插入失败：${err.message}`],
        data: product
      });
    }
  }

  ctx.body = {
    success: true,
    data: {
      total: rows.length,
      successCount,
      failCount,
      errors
    },
    message: successCount > 0
      ? `导入完成：成功 ${successCount} 条，失败 ${failCount} 条`
      : `导入失败：${failCount} 条数据存在错误`
  };
});

router.get('/:id', async (ctx) => {
  const { id } = ctx.params;
  const globalConfig = await getGlobalConfig();
  const product = await getQuery(`
    SELECT 
      p.*,
      COALESCE(sac.threshold, ?) as alert_threshold,
      COALESCE(sac.enabled, ?) as alert_enabled
    FROM products p
    LEFT JOIN stock_alert_config sac ON p.id = sac.product_id
    WHERE p.id = ?
  `, [globalConfig.default_threshold, globalConfig.enabled, id]);

  if (!product) {
    ctx.status = 404;
    ctx.body = { success: false, message: '商品不存在' };
    return;
  }

  const enriched = await enrichProductWithSpecs(product);
  const displayStock = enriched.has_multi_spec ? enriched.total_stock : product.stock;
  const alertEnabled = product.alert_enabled === 1 && globalConfig.enabled === 1;
  const isAlert = alertEnabled && displayStock < product.alert_threshold;

  const promotion = await getProductActivePromotion(id);
  const promotionData = promotion ? {
    id: promotion.id,
    name: promotion.name,
    type: promotion.type,
    rules: promotion.rules,
    description: promotion.description,
    display_text: getPromotionDisplayText(promotion),
    price: calculatePromotionPrice(promotion, product.price, 1)
  } : null;

  ctx.body = {
    success: true,
    data: {
      id: enriched.id,
      name: enriched.name,
      description: enriched.description,
      price: enriched.price,
      category: enriched.category,
      stock: displayStock,
      image: enriched.image,
      has_multi_spec: enriched.has_multi_spec,
      min_price: enriched.min_price,
      max_price: enriched.max_price,
      total_stock: enriched.total_stock,
      specs: enriched.specs,
      skus: enriched.skus,
      created_at: enriched.created_at,
      updated_at: enriched.updated_at,
      alert_threshold: product.alert_threshold,
      alert_enabled: alertEnabled,
      is_alert: isAlert,
      promotion: promotionData
    }
  };
});

router.get('/:id/skus', async (ctx) => {
  const { id } = ctx.params;
  const product = await getQuery('SELECT id, has_multi_spec FROM products WHERE id = ?', [id]);
  if (!product) {
    ctx.status = 404;
    ctx.body = { success: false, message: '商品不存在' };
    return;
  }

  if (product.has_multi_spec !== 1) {
    ctx.body = {
      success: true,
      data: {
        has_multi_spec: false,
        specs: [],
        skus: []
      }
    };
    return;
  }

  const specs = await getProductSpecs(id);
  const skus = await getProductSkus(id);

  ctx.body = {
    success: true,
    data: {
      has_multi_spec: true,
      specs,
      skus
    }
  };
});

async function saveProductSpecsAndSkus(productId, hasMultiSpec, specs, skus) {
  await runQuery('DELETE FROM product_specs WHERE product_id = ?', [productId]);
  await runQuery('DELETE FROM product_spec_values WHERE product_id = ?', [productId]);
  await runQuery('DELETE FROM product_skus WHERE product_id = ?', [productId]);

  if (!hasMultiSpec || !specs || !skus) return;

  const specIdMap = {};
  for (let si = 0; si < specs.length; si++) {
    const spec = specs[si];
    const specResult = await runQuery(
      'INSERT INTO product_specs (product_id, name, sort_order) VALUES (?, ?, ?)',
      [productId, spec.name, si]
    );
    const dbSpecId = specResult.lastID;
    specIdMap[spec.name] = { id: dbSpecId, valueMap: {} };

    if (spec.values && Array.isArray(spec.values)) {
      for (let vi = 0; vi < spec.values.length; vi++) {
        const val = spec.values[vi];
        const valResult = await runQuery(
          'INSERT INTO product_spec_values (spec_id, product_id, value, sort_order) VALUES (?, ?, ?, ?)',
          [dbSpecId, productId, val, vi]
        );
        specIdMap[spec.name].valueMap[val] = valResult.lastID;
      }
    }
  }

  if (skus && Array.isArray(skus)) {
    for (let si = 0; si < skus.length; si++) {
      const sku = skus[si];
      const specValueIds = [];
      const specTextParts = [];
      if (sku.specs && typeof sku.specs === 'object') {
        for (const [specName, specValue] of Object.entries(sku.specs)) {
          if (specIdMap[specName] && specIdMap[specName].valueMap[specValue] !== undefined) {
            specValueIds.push(specIdMap[specName].valueMap[specValue]);
          }
          specTextParts.push(`${specName}:${specValue}`);
        }
      }
      const sortedValueIds = specValueIds.sort((a, b) => a - b).join(',');
      const specText = specTextParts.join(';');
      await runQuery(
        `INSERT INTO product_skus (product_id, sku_code, price, stock, image, spec_value_ids, spec_text)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          productId,
          sku.sku_code || `SKU-${productId}-${String(si).padStart(3, '0')}`,
          sku.price,
          sku.stock || 0,
          sku.image || null,
          sortedValueIds,
          specText
        ]
      );
    }
  }
}

router.post('/', authMiddleware, async (ctx) => {
  const {
    name, description, price, category, stock = 0, image,
    has_multi_spec = false, specs = [], skus = []
  } = ctx.request.body;

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

  if (has_multi_spec && (!skus || skus.length === 0)) {
    ctx.status = 400;
    ctx.body = { success: false, message: '启用多规格时必须设置至少一个 SKU' };
    return;
  }

  const result = await runQuery(`
    INSERT INTO products (name, description, price, category, stock, image, has_multi_spec)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [name, description, price, category, stock, image, has_multi_spec ? 1 : 0]);

  const productId = result.lastID;

  if (has_multi_spec) {
    await saveProductSpecsAndSkus(productId, true, specs, skus);
  }

  ctx.status = 201;
  ctx.body = {
    success: true,
    data: { id: productId, name, description, price, category, stock, image, has_multi_spec }
  };
});

router.put('/:id', authMiddleware, async (ctx) => {
  const { id } = ctx.params;
  const {
    name, description, price, category, stock, image,
    has_multi_spec, specs, skus
  } = ctx.request.body;

  const existing = await getQuery('SELECT * FROM products WHERE id = ?', [id]);

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

  if (has_multi_spec && (!skus || skus.length === 0)) {
    ctx.status = 400;
    ctx.body = { success: false, message: '启用多规格时必须设置至少一个 SKU' };
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
  if (has_multi_spec !== undefined) {
    updateFields.push('has_multi_spec = ?');
    updateValues.push(has_multi_spec ? 1 : 0);
  }

  updateFields.push('updated_at = CURRENT_TIMESTAMP');
  updateValues.push(id);

  await runQuery(`
    UPDATE products SET ${updateFields.join(', ')}
    WHERE id = ?
  `, updateValues);

  if (has_multi_spec !== undefined || specs !== undefined || skus !== undefined) {
    const finalHasMultiSpec = has_multi_spec !== undefined ? has_multi_spec : existing.has_multi_spec === 1;
    const finalSpecs = specs !== undefined ? specs : (await getProductSpecs(id));
    const finalSkus = skus !== undefined ? skus : (await getProductSkus(id));
    await saveProductSpecsAndSkus(id, finalHasMultiSpec, finalSpecs, finalSkus);
  }

  const updatedProduct = await getQuery('SELECT * FROM products WHERE id = ?', [id]);
  const enriched = await enrichProductWithSpecs(updatedProduct);

  ctx.body = { success: true, data: enriched };
});

router.delete('/:id', authMiddleware, async (ctx) => {
  const { id } = ctx.params;

  const existing = await getQuery('SELECT * FROM products WHERE id = ?', [id]);

  if (!existing) {
    ctx.status = 404;
    ctx.body = { success: false, message: '商品不存在' };
    return;
  }

  await runQuery('DELETE FROM products WHERE id = ?', [id]);

  ctx.body = { success: true, message: '删除成功' };
});

export default router;
