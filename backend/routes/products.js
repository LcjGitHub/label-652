const Router = require('koa-router');
const multer = require('@koa/multer');
const ExcelJS = require('exceljs');
const { categories, runQuery, getQuery, allQuery } = require('../database');
const { authMiddleware } = require('../middleware/auth');

const router = new Router({ prefix: '/api/products' });
const upload = multer({ storage: multer.memoryStorage() });

const EXCEL_HEADERS = [
  { key: 'name', header: '商品名称', width: 30, required: true },
  { key: 'description', header: '商品描述', width: 50, required: false },
  { key: 'price', header: '价格', width: 15, required: true },
  { key: 'category', header: '分类', width: 15, required: true },
  { key: 'stock', header: '库存', width: 10, required: false },
  { key: 'image', header: '图片链接', width: 50, required: false }
];

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

  const countResult = await getQuery(`SELECT COUNT(*) as total FROM products ${whereClause}`, params);
  const total = countResult.total;

  const products = await allQuery(`
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
  const product = await getQuery('SELECT * FROM products WHERE id = ?', [id]);

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

  const result = await runQuery(`
    INSERT INTO products (name, description, price, category, stock, image)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [name, description, price, category, stock, image]);

  ctx.status = 201;
  ctx.body = {
    success: true,
    data: { id: result.lastID, name, description, price, category, stock, image }
  };
});

router.put('/:id', authMiddleware, async (ctx) => {
  const { id } = ctx.params;
  const { name, description, price, category, stock, image } = ctx.request.body;

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

  await runQuery(`
    UPDATE products SET ${updateFields.join(', ')}
    WHERE id = ?
  `, updateValues);

  const updatedProduct = await getQuery('SELECT * FROM products WHERE id = ?', [id]);

  ctx.body = { success: true, data: updatedProduct };
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

router.get('/export', async (ctx) => {
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

router.get('/template', async (ctx) => {
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

router.post('/import', upload.single('file'), async (ctx) => {
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
      data[h.key] = row.getCell(index + 1).value;
    });
    if (Object.values(data).some(v => v !== null && v !== undefined && v !== '')) {
      rows.push({ rowNumber, data });
    }
  });

  if (rows.length === 0) {
    ctx.status = 400;
    ctx.body = { success: false, message: 'Excel 文件中没有有效数据' };
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

module.exports = router;
