import { createClient } from '@libsql/client/node';
import config from '../config.js';
import bcrypt from 'bcryptjs';

const dbPath = config.database.path;
const JWT_SECRET = config.jwt?.secret || 'your-secret-key-change-in-production';

const db = createClient({
  url: `file:${dbPath}`
});

const categories = ['电子产品', '服装', '食品', '家居', '图书', '运动'];

async function addColumnIfNotExists(tableName, columnName, columnDef) {
  try {
    const columns = await allQuery(`PRAGMA table_info(${tableName})`);
    const exists = columns.some(col => col.name === columnName);
    if (!exists) {
      await db.execute(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`);
    }
  } catch (err) {
    console.warn(`添加列 ${tableName}.${columnName} 失败:`, err.message);
  }
}

async function rebuildCartsTableForUniqueConstraint() {
  try {
    const existing = await allQuery("SELECT name FROM sqlite_master WHERE type='table' AND name='carts'");
    if (existing.length === 0) return;

    const indexes = await allQuery("PRAGMA index_list('carts')");
    const uniqueIdx = indexes.find(i => i.origin === 'u');
    const columns = await allQuery("PRAGMA table_info(carts)");
    const colNames = columns.map(c => c.name).join(',');

    const needsRebuild = colNames.includes('sku_id') && (!uniqueIdx || !colNames.includes('sku_name'));
    if (!needsRebuild) return;

    console.log('正在重建 carts 表以支持多 SKU 唯一约束...');

    await db.execute('BEGIN');
    const rows = await allQuery('SELECT * FROM carts');
    await db.execute("ALTER TABLE carts RENAME TO carts_old");

    await db.execute(`
      CREATE TABLE carts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        sku_id INTEGER,
        sku_name TEXT,
        quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (sku_id) REFERENCES product_skus(id) ON DELETE SET NULL,
        UNIQUE(user_id, product_id, sku_id)
      )
    `);

    for (const row of rows) {
      const keys = Object.keys(row).join(',');
      const placeholders = Object.keys(row).map(() => '?').join(',');
      const values = Object.values(row);
      await db.execute(`INSERT INTO carts (${keys}) VALUES (${placeholders})`, values);
    }

    await db.execute("DROP TABLE IF EXISTS carts_old");
    await db.execute('COMMIT');
    console.log('carts 表重建完成');
  } catch (err) {
    try { await db.execute('ROLLBACK'); } catch (e) {}
    console.warn('重建 carts 表失败（功能不受影响）:', err.message);
  }
}

async function initDatabase() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      category TEXT NOT NULL,
      stock INTEGER DEFAULT 0,
      image TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await addColumnIfNotExists('products', 'has_multi_spec', 'INTEGER DEFAULT 0');

  await db.execute(`
    CREATE TABLE IF NOT EXISTS product_specs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS product_spec_values (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      spec_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      value TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (spec_id) REFERENCES product_specs(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS product_skus (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      sku_code TEXT,
      price REAL NOT NULL,
      stock INTEGER DEFAULT 0,
      image TEXT,
      spec_value_ids TEXT,
      spec_text TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      avatar TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
      content TEXT,
      images TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      UNIQUE(user_id, product_id)
    )
  `);

  await addColumnIfNotExists('carts', 'sku_id', 'INTEGER');
  await addColumnIfNotExists('carts', 'sku_name', 'TEXT');
  await db.execute(`
    CREATE TABLE IF NOT EXISTS carts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      sku_id INTEGER,
      sku_name TEXT,
      quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (sku_id) REFERENCES product_skus(id) ON DELETE SET NULL,
      UNIQUE(user_id, product_id, sku_id)
    )
  `);
  await rebuildCartsTableForUniqueConstraint();

  await db.execute(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      order_no TEXT NOT NULL UNIQUE,
      total_amount REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      shipping_address TEXT,
      payment_method TEXT,
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await addColumnIfNotExists('order_items', 'sku_id', 'INTEGER');
  await addColumnIfNotExists('order_items', 'sku_name', 'TEXT');
  await db.execute(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      sku_id INTEGER,
      sku_name TEXT,
      product_name TEXT NOT NULL,
      product_price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      subtotal REAL NOT NULL,
      product_image TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
      FOREIGN KEY (sku_id) REFERENCES product_skus(id) ON DELETE SET NULL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS search_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      keyword TEXT NOT NULL,
      search_count INTEGER DEFAULT 1,
      last_searched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_search_history_keyword ON search_history(keyword);
    CREATE INDEX IF NOT EXISTS idx_search_history_user ON search_history(user_id);
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS browse_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      product_id INTEGER NOT NULL,
      viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_browse_history_user ON browse_history(user_id);
    CREATE INDEX IF NOT EXISTS idx_browse_history_product ON browse_history(product_id);
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS stock_alert_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER UNIQUE,
      threshold INTEGER NOT NULL DEFAULT 10,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_stock_alert_config_product ON stock_alert_config(product_id);
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      UNIQUE(user_id, product_id)
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
    CREATE INDEX IF NOT EXISTS idx_favorites_product ON favorites(product_id);
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS stock_alert_global_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      default_threshold INTEGER NOT NULL DEFAULT 10,
      enabled INTEGER NOT NULL DEFAULT 1,
      notify_email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS restock_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_no TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'pending',
      total_items INTEGER NOT NULL DEFAULT 0,
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS restock_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restock_order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      current_stock INTEGER NOT NULL DEFAULT 0,
      threshold INTEGER NOT NULL DEFAULT 0,
      suggested_quantity INTEGER NOT NULL DEFAULT 0,
      unit_price REAL NOT NULL DEFAULT 0,
      subtotal REAL NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (restock_order_id) REFERENCES restock_orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    )
  `);

  const productCountResult = await db.execute('SELECT COUNT(*) as count FROM products');
  const productCount = productCountResult.rows[0].count;

  if (productCount === 0) {
    const sampleProducts = [
      { name: 'iPhone 15', desc: '最新款苹果手机，搭载 A17 芯片', price: 6999, category: '电子产品', stock: 50, image: '/products/iphone15-phone.svg' },
      { name: 'MacBook Pro', desc: '14英寸专业笔记本电脑', price: 14999, category: '电子产品', stock: 30, image: '/products/macbook-laptop.svg' },
      { name: 'AirPods Pro', desc: '主动降噪无线耳机', price: 1899, category: '电子产品', stock: 100, image: '/products/airpods-earbuds.svg' },
      { name: '运动T恤', desc: '纯棉透气运动上衣', price: 99, category: '服装', stock: 200, image: '/products/tshirt-clothing.svg' },
      { name: '牛仔裤', desc: '经典直筒牛仔长裤', price: 299, category: '服装', stock: 150, image: '/products/jeans-pants.svg' },
      { name: '运动鞋', desc: '轻便透气跑步鞋', price: 599, category: '运动', stock: 80, image: '/products/running-shoes.svg' },
      { name: '有机牛奶', desc: '全脂纯牛奶 1L装', price: 15, category: '食品', stock: 500, image: '/products/milk-dairy.svg' },
      { name: '进口巧克力', desc: '比利时黑巧克力礼盒', price: 128, category: '食品', stock: 60, image: '/products/chocolate-sweet.svg' },
      { name: '速溶咖啡', desc: '阿拉比卡冻干咖啡粉', price: 68, category: '食品', stock: 300, image: '/products/coffee-drink.svg' },
      { name: '北欧台灯', desc: 'LED护眼阅读台灯', price: 258, category: '家居', stock: 45, image: '/products/desk-lamp.svg' },
      { name: '收纳盒', desc: '多功能塑料收纳箱', price: 45, category: '家居', stock: 120, image: '/products/storage-box.svg' },
      { name: '香薰蜡烛', desc: '天然大豆蜡香薰', price: 78, category: '家居', stock: 90, image: '/products/candle-decor.svg' },
      { name: 'JavaScript高级程序设计', desc: '前端开发经典教材', price: 129, category: '图书', stock: 75, image: '/products/programming-book.svg' },
      { name: '活着', desc: '余华经典文学作品', price: 39, category: '图书', stock: 200, image: '/products/novel-book.svg' },
      { name: '瑜伽垫', desc: '加厚防滑健身垫', price: 89, category: '运动', stock: 150, image: '/products/yoga-mat.svg' },
      { name: '哑铃套装', desc: '可调节重量哑铃 20kg', price: 399, category: '运动', stock: 40, image: '/products/dumbbell-gym.svg' },
    ];

    const insertSql = `
      INSERT INTO products (name, description, price, category, stock, image)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    for (const p of sampleProducts) {
      await db.execute({
        sql: insertSql,
        args: [p.name, p.desc, p.price, p.category, p.stock, p.image]
      });
    }

    console.log('已插入示例商品数据');
  }

  const userCountResult = await db.execute('SELECT COUNT(*) as count FROM users');
  const userCount = userCountResult.rows[0].count;

  if (userCount === 0) {
    const hashedPassword = await bcrypt.hash('123456', 10);
    const sampleUsers = [
      { username: '张三', email: 'zhangsan@example.com', password: hashedPassword, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=zhangsan' },
      { username: '李四', email: 'lisi@example.com', password: hashedPassword, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=lisi' },
      { username: '王五', email: 'wangwu@example.com', password: hashedPassword, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=wangwu' },
    ];

    const userSql = 'INSERT INTO users (username, email, password, avatar) VALUES (?, ?, ?, ?)';
    for (const u of sampleUsers) {
      await db.execute({ sql: userSql, args: [u.username, u.email, u.password, u.avatar] });
    }

    console.log('已插入示例用户数据（含张三等演示账号）');
  }

  const reviewCountResult = await db.execute('SELECT COUNT(*) as count FROM reviews');
  const reviewCount = reviewCountResult.rows[0].count;

  if (reviewCount === 0) {
    const sampleReviews = [
      { user_id: 1, product_id: 1, rating: 5, content: '非常好用，性能强劲，拍照效果也很棒！', images: '[]' },
      { user_id: 2, product_id: 1, rating: 4, content: '整体不错，就是价格有点贵。', images: '[]' },
      { user_id: 3, product_id: 1, rating: 5, content: 'iOS系统流畅，用了几个月一点都不卡。', images: '[]' },
      { user_id: 1, product_id: 2, rating: 5, content: '做工精细，屏幕素质一流，办公娱乐两不误。', images: '[]' },
      { user_id: 2, product_id: 2, rating: 4, content: '性能很强，续航也不错，就是有点重。', images: '[]' },
      { user_id: 1, product_id: 5, rating: 4, content: '穿着很舒服，透气性好，就是颜色选择少了点。', images: '[]' },
      { user_id: 3, product_id: 8, rating: 5, content: '牛奶很新鲜，味道醇厚，每天都喝。', images: '[]' },
      { user_id: 2, product_id: 11, rating: 5, content: '台灯造型好看，光线柔和不刺眼，看书很舒服。', images: '[]' },
      { user_id: 1, product_id: 13, rating: 5, content: '前端开发必读，内容详实，值得推荐！', images: '[]' },
      { user_id: 2, product_id: 13, rating: 4, content: '书的质量很好，就是价格有点贵。', images: '[]' },
      { user_id: 3, product_id: 13, rating: 3, content: '内容不错，但有些章节太深奥了。', images: '[]' },
    ];

    const reviewSql = 'INSERT INTO reviews (user_id, product_id, rating, content, images) VALUES (?, ?, ?, ?, ?)';
    for (const r of sampleReviews) {
      await db.execute({ sql: reviewSql, args: [r.user_id, r.product_id, r.rating, r.content, r.images] });
    }

    console.log('已插入示例评价数据');
  }

  const globalConfigCount = await db.execute('SELECT COUNT(*) as count FROM stock_alert_global_config');
  if (globalConfigCount.rows[0].count === 0) {
    await db.execute(`
      INSERT INTO stock_alert_global_config (default_threshold, enabled, notify_email)
      VALUES (20, 1, 'admin@example.com')
    `);
    console.log('已插入全局库存预警配置');
  }

  const alertConfigCount = await db.execute('SELECT COUNT(*) as count FROM stock_alert_config');
  if (alertConfigCount.rows[0].count === 0) {
    const sampleThresholds = [
      { product_id: 1, threshold: 15 },
      { product_id: 2, threshold: 10 },
      { product_id: 3, threshold: 20 },
      { product_id: 4, threshold: 50 },
      { product_id: 5, threshold: 30 },
      { product_id: 6, threshold: 20 },
      { product_id: 7, threshold: 100 },
      { product_id: 8, threshold: 30 },
      { product_id: 9, threshold: 50 },
      { product_id: 10, threshold: 15 },
      { product_id: 11, threshold: 25 },
      { product_id: 12, threshold: 20 },
      { product_id: 13, threshold: 20 },
      { product_id: 14, threshold: 50 },
      { product_id: 15, threshold: 30 },
      { product_id: 16, threshold: 10 },
    ];
    for (const s of sampleThresholds) {
      await db.execute(`
        INSERT INTO stock_alert_config (product_id, threshold, enabled)
        VALUES (?, ?, 1)
      `, [s.product_id, s.threshold]);
    }
    console.log('已插入示例商品预警阈值配置');
  }

  const skuCountResult = await db.execute('SELECT COUNT(*) as count FROM product_skus');
  if (skuCountResult.rows[0].count === 0) {
    const sampleSpecProducts = [
      { product_id: 4, name: '运动T恤', specs: [
        { name: '颜色', values: ['白色', '黑色', '蓝色'] },
        { name: '尺码', values: ['S', 'M', 'L', 'XL'] }
      ], basePrice: 99 },
      { product_id: 5, name: '牛仔裤', specs: [
        { name: '颜色', values: ['深蓝', '浅蓝', '黑色'] },
        { name: '尺码', values: ['28', '30', '32', '34', '36'] }
      ], basePrice: 299 },
      { product_id: 6, name: '运动鞋', specs: [
        { name: '颜色', values: ['白色', '黑色', '红色'] },
        { name: '尺码', values: ['39', '40', '41', '42', '43', '44'] }
      ], basePrice: 599 },
      { product_id: 15, name: '瑜伽垫', specs: [
        { name: '颜色', values: ['紫色', '蓝色', '粉色'] },
        { name: '厚度', values: ['6mm', '8mm', '10mm'] }
      ], basePrice: 89 },
      { product_id: 16, name: '哑铃套装', specs: [
        { name: '重量', values: ['10kg', '20kg', '30kg'] }
      ], basePrice: 399 }
    ];

    for (const sp of sampleSpecProducts) {
      await runQuery('UPDATE products SET has_multi_spec = 1 WHERE id = ?', [sp.product_id]);

      const specIds = [];
      for (let si = 0; si < sp.specs.length; si++) {
        const spec = sp.specs[si];
        const specResult = await runQuery(
          'INSERT INTO product_specs (product_id, name, sort_order) VALUES (?, ?, ?)',
          [sp.product_id, spec.name, si]
        );
        const specId = specResult.lastID;
        const valueIds = [];
        for (let vi = 0; vi < spec.values.length; vi++) {
          const valResult = await runQuery(
            'INSERT INTO product_spec_values (spec_id, product_id, value, sort_order) VALUES (?, ?, ?, ?)',
            [specId, sp.product_id, spec.values[vi], vi]
          );
          valueIds.push(valResult.lastID);
        }
        specIds.push({ specId, name: spec.name, values: spec.values, valueIds });
      }

      const generateCombinations = (specs, index = 0, current = []) => {
        if (index >= specs.length) return [current];
        const result = [];
        for (let i = 0; i < specs[index].values.length; i++) {
          result.push(...generateCombinations(specs, index + 1,
            [...current, { value: specs[index].values[i], valueId: specs[index].valueIds[i], specName: specs[index].name }]
          ));
        }
        return result;
      };

      const combinations = generateCombinations(specIds);
      let skuIndex = 0;
      for (const combo of combinations) {
        const skuCode = `SKU-${sp.product_id}-${String(skuIndex).padStart(3, '0')}`;
        const specValueIds = combo.map(c => c.valueId).sort((a, b) => a - b).join(',');
        const specText = combo.map(c => `${c.specName}:${c.value}`).join(';');
        const priceVariation = Math.floor(skuIndex / 2) * 10;
        const skuPrice = sp.basePrice + priceVariation;
        const skuStock = Math.floor(Math.random() * 80) + 20;
        await runQuery(
          `INSERT INTO product_skus (product_id, sku_code, price, stock, spec_value_ids, spec_text)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [sp.product_id, skuCode, skuPrice, skuStock, specValueIds, specText]
        );
        skuIndex++;
      }
    }

    console.log('已插入示例商品规格数据');
  }

  await db.execute(`
    CREATE TABLE IF NOT EXISTS promotions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('full_reduction', 'discount', 'buy_one_get_one')),
      description TEXT,
      start_time DATETIME NOT NULL,
      end_time DATETIME NOT NULL,
      status INTEGER DEFAULT 1,
      rules TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS promotion_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      promotion_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (promotion_id) REFERENCES promotions(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      UNIQUE(promotion_id, product_id)
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_promotion_products_promotion ON promotion_products(promotion_id);
    CREATE INDEX IF NOT EXISTS idx_promotion_products_product ON promotion_products(product_id);
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('fixed', 'percent')),
      value REAL NOT NULL,
      min_amount REAL DEFAULT 0,
      total_count INTEGER DEFAULT 0,
      used_count INTEGER DEFAULT 0,
      start_time DATETIME NOT NULL,
      end_time DATETIME NOT NULL,
      status INTEGER DEFAULT 1,
      description TEXT,
      per_user_limit INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS user_coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      coupon_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'unused' CHECK (status IN ('unused', 'used', 'expired')),
      used_order_id INTEGER,
      received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      used_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE,
      FOREIGN KEY (used_order_id) REFERENCES orders(id) ON DELETE SET NULL
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_user_coupons_user ON user_coupons(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_coupons_coupon ON user_coupons(coupon_id);
    CREATE INDEX IF NOT EXISTS idx_user_coupons_status ON user_coupons(status);
  `);

  await addColumnIfNotExists('orders', 'discount_amount', 'REAL DEFAULT 0');
  await addColumnIfNotExists('orders', 'coupon_id', 'INTEGER');
  await addColumnIfNotExists('orders', 'promotion_discount', 'REAL DEFAULT 0');
  await addColumnIfNotExists('orders', 'coupon_discount', 'REAL DEFAULT 0');
  await addColumnIfNotExists('coupons', 'product_id', 'INTEGER');
  await addColumnIfNotExists('coupons', 'category', 'TEXT');

  const promotionCountResult = await db.execute('SELECT COUNT(*) as count FROM promotions');
  if (promotionCountResult.rows[0].count === 0) {
    const now = new Date();
    const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const samplePromotions = [
      {
        name: '电子产品8折优惠',
        type: 'discount',
        description: '全场电子产品享8折优惠',
        rules: JSON.stringify({ discount: 0.8 }),
        products: [1, 2, 3]
      },
      {
        name: '满299减50',
        type: 'full_reduction',
        description: '服装类满299元减50元',
        rules: JSON.stringify({ threshold: 299, reduction: 50 }),
        products: [4, 5, 6]
      },
      {
        name: '食品买一送一',
        type: 'buy_one_get_one',
        description: '指定食品买一送一',
        rules: JSON.stringify({}),
        products: [7, 8, 9]
      }
    ];

    for (const promo of samplePromotions) {
      const promoResult = await runQuery(
        `INSERT INTO promotions (name, type, description, start_time, end_time, status, rules)
         VALUES (?, ?, ?, ?, ?, 1, ?)`,
        [promo.name, promo.type, promo.description, now.toISOString(), future.toISOString(), promo.rules]
      );
      const promotionId = promoResult.lastID;

      for (const productId of promo.products) {
        await runQuery(
          'INSERT INTO promotion_products (promotion_id, product_id) VALUES (?, ?)',
          [promotionId, productId]
        );
      }
    }

    console.log('已插入示例促销活动数据');
  }

  const couponCountResult = await db.execute('SELECT COUNT(*) as count FROM coupons');
  if (couponCountResult.rows[0].count === 0) {
    const now = new Date();
    const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const sampleCoupons = [
      {
        name: '新人50元优惠券',
        type: 'fixed',
        value: 50,
        min_amount: 200,
        total_count: 100,
        description: '新用户专享，满200元可用',
        per_user_limit: 1,
        product_id: null,
        category: null
      },
      {
        name: '全场9折优惠券',
        type: 'percent',
        value: 0.9,
        min_amount: 100,
        total_count: 500,
        description: '全场通用9折，满100元可用',
        per_user_limit: 2,
        product_id: null,
        category: null
      },
      {
        name: '满500减100',
        type: 'fixed',
        value: 100,
        min_amount: 500,
        total_count: 200,
        description: '满500元减100元',
        per_user_limit: 1,
        product_id: null,
        category: null
      },
      {
        name: '食品满100减20',
        type: 'fixed',
        value: 20,
        min_amount: 100,
        total_count: 300,
        description: '食品类满100元减20元',
        per_user_limit: 1,
        product_id: null,
        category: '食品'
      }
    ];

    for (const coupon of sampleCoupons) {
      await runQuery(
        `INSERT INTO coupons (name, type, value, min_amount, total_count, used_count, start_time, end_time, status, description, per_user_limit, product_id, category)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?, 1, ?, ?, ?, ?)`,
        [coupon.name, coupon.type, coupon.value, coupon.min_amount, coupon.total_count, now.toISOString(), future.toISOString(), coupon.description, coupon.per_user_limit, coupon.product_id, coupon.category]
      );
    }

    console.log('已插入示例优惠券数据');
  }
}

async function runQuery(sql, args = []) {
  const result = await db.execute({ sql, args });
  return {
    lastID: result.lastInsertRowid?.toString(),
    changes: result.rowsAffected
  };
}

async function getQuery(sql, args = []) {
  const result = await db.execute({ sql, args });
  return result.rows.length > 0 ? result.rows[0] : undefined;
}

async function allQuery(sql, args = []) {
  const result = await db.execute({ sql, args });
  return result.rows;
}

const dbReady = initDatabase().catch(err => {
  console.error('数据库初始化失败:', err);
  throw err;
});

async function getProductSpecs(productId) {
  const specs = await allQuery(`
    SELECT * FROM product_specs WHERE product_id = ? ORDER BY sort_order, id
  `, [productId]);

  for (const spec of specs) {
    spec.values = await allQuery(`
      SELECT * FROM product_spec_values WHERE spec_id = ? ORDER BY sort_order, id
    `, [spec.id]);
  }
  return specs;
}

async function getProductSkus(productId) {
  return await allQuery(`
    SELECT * FROM product_skus WHERE product_id = ? ORDER BY id
  `, [productId]);
}

async function getProductStock(productId, skuId = null) {
  if (skuId) {
    const sku = await getQuery('SELECT stock FROM product_skus WHERE id = ? AND product_id = ?', [skuId, productId]);
    return sku ? sku.stock : 0;
  }
  const product = await getQuery('SELECT stock, has_multi_spec FROM products WHERE id = ?', [productId]);
  if (!product) return 0;
  if (product.has_multi_spec) {
    const skus = await allQuery('SELECT COALESCE(SUM(stock), 0) as total FROM product_skus WHERE product_id = ?', [productId]);
    return skus[0]?.total || 0;
  }
  return product.stock;
}

async function getProductPriceRange(productId) {
  const product = await getQuery('SELECT price, has_multi_spec FROM products WHERE id = ?', [productId]);
  if (!product) return { min_price: 0, max_price: 0 };
  if (!product.has_multi_spec) {
    return { min_price: product.price, max_price: product.price };
  }
  const result = await getQuery(`
    SELECT COALESCE(MIN(price), 0) as min_price, COALESCE(MAX(price), 0) as max_price
    FROM product_skus WHERE product_id = ?
  `, [productId]);
  return result || { min_price: product.price, max_price: product.price };
}

async function getProductPromotions(productId) {
  const now = new Date().toISOString();
  return await allQuery(`
    SELECT p.* FROM promotions p
    INNER JOIN promotion_products pp ON p.id = pp.promotion_id
    WHERE pp.product_id = ? 
      AND p.status = 1 
      AND p.start_time <= ? 
      AND p.end_time >= ?
    ORDER BY p.created_at DESC
  `, [productId, now, now]);
}

async function getAllActivePromotions() {
  const now = new Date().toISOString();
  const promotions = await allQuery(`
    SELECT * FROM promotions 
    WHERE status = 1 AND start_time <= ? AND end_time >= ?
    ORDER BY created_at DESC
  `, [now, now]);

  for (const promo of promotions) {
    promo.products = await allQuery(`
      SELECT product_id FROM promotion_products WHERE promotion_id = ?
    `, [promo.id]);
    if (promo.rules) {
      try {
        promo.rules = JSON.parse(promo.rules);
      } catch (e) {}
    }
  }
  return promotions;
}

async function getProductActivePromotion(productId) {
  const promotions = await getProductPromotions(productId);
  if (promotions.length === 0) return null;

  const now = new Date().toISOString();
  const activePromos = promotions.filter(p => {
    return p.status === 1 && p.start_time <= now && p.end_time >= now;
  });

  if (activePromos.length === 0) return null;

  const bestPromo = activePromos[0];
  if (bestPromo.rules) {
    try {
      bestPromo.rules = JSON.parse(bestPromo.rules);
    } catch (e) {}
  }
  return bestPromo;
}

function calculatePromotionPrice(promotion, originalPrice, quantity = 1) {
  if (!promotion) return { finalPrice: originalPrice * quantity, discount: 0, promotion };

  const totalOriginal = originalPrice * quantity;

  switch (promotion.type) {
    case 'discount': {
      const discount = promotion.rules?.discount || 1;
      const finalPrice = totalOriginal * discount;
      return {
        finalPrice: Math.round(finalPrice * 100) / 100,
        discount: Math.round((totalOriginal - finalPrice) * 100) / 100,
        promotion
      };
    }
    case 'full_reduction': {
      const threshold = promotion.rules?.threshold || 0;
      const reduction = promotion.rules?.reduction || 0;
      if (totalOriginal >= threshold) {
        return {
          finalPrice: Math.round((totalOriginal - reduction) * 100) / 100,
          discount: reduction,
          promotion
        };
      }
      return { finalPrice: totalOriginal, discount: 0, promotion };
    }
    case 'buy_one_get_one': {
      const effectiveQuantity = Math.ceil(quantity / 2);
      const finalPrice = originalPrice * effectiveQuantity;
      return {
        finalPrice: Math.round(finalPrice * 100) / 100,
        discount: Math.round((totalOriginal - finalPrice) * 100) / 100,
        promotion
      };
    }
    default:
      return { finalPrice: totalOriginal, discount: 0, promotion };
  }
}

function getPromotionDisplayText(promotion) {
  if (!promotion) return null;

  switch (promotion.type) {
    case 'discount':
      const discount = promotion.rules?.discount || 1;
      const discountPercent = Math.round(discount * 10);
      return `${discountPercent}折`;
    case 'full_reduction':
      const threshold = promotion.rules?.threshold || 0;
      const reduction = promotion.rules?.reduction || 0;
      return `满${threshold}减${reduction}`;
    case 'buy_one_get_one':
      return '买一送一';
    default:
      return null;
  }
}

async function getAvailableCoupons() {
  const now = new Date().toISOString();
  return await allQuery(`
    SELECT * FROM coupons 
    WHERE status = 1 
      AND start_time <= ? 
      AND end_time >= ?
      AND (total_count = 0 OR used_count < total_count)
    ORDER BY created_at DESC
  `, [now, now]);
}

async function getUserCoupons(userId, status = null) {
  let whereClause = 'WHERE uc.user_id = ?';
  const params = [userId];

  if (status) {
    whereClause += ' AND uc.status = ?';
    params.push(status);
  }

  const userCoupons = await allQuery(`
    SELECT uc.*, c.name, c.type, c.value, c.min_amount, c.description, c.start_time, c.end_time
    FROM user_coupons uc
    INNER JOIN coupons c ON uc.coupon_id = c.id
    ${whereClause}
    ORDER BY uc.received_at DESC
  `, params);

  const now = new Date().toISOString();
  for (const uc of userCoupons) {
    if (uc.status === 'unused' && uc.end_time < now) {
      uc.status = 'expired';
    }
  }
  return userCoupons;
}

function calculateCouponDiscount(coupon, totalAmount) {
  if (!coupon) return { discount: 0, valid: false };

  if (totalAmount < (coupon.min_amount || 0)) {
    return { discount: 0, valid: false, reason: `未满${coupon.min_amount}元` };
  }

  if (coupon.type === 'fixed') {
    return {
      discount: Math.min(coupon.value, totalAmount),
      valid: true
    };
  } else if (coupon.type === 'percent') {
    const discount = totalAmount * (1 - coupon.value);
    return {
      discount: Math.round(discount * 100) / 100,
      valid: true
    };
  }
  return { discount: 0, valid: false };
}

function getCouponDisplayText(coupon) {
  if (!coupon) return null;
  if (coupon.type === 'fixed') {
    return `¥${coupon.value}`;
  } else if (coupon.type === 'percent') {
    const percent = Math.round(coupon.value * 10);
    return `${percent}折`;
  }
  return null;
}

async function calculateCartPromotions(cartItems) {
  let totalPromotionDiscount = 0;
  const itemPromotions = [];

  for (const item of cartItems) {
    const price = item.sku_price != null ? item.sku_price : item.product_price;
    const promotion = await getProductActivePromotion(item.product_id);
    const result = calculatePromotionPrice(promotion, price, item.quantity);

    itemPromotions.push({
      product_id: item.product_id,
      sku_id: item.sku_id || null,
      originalPrice: price,
      originalSubtotal: price * item.quantity,
      finalSubtotal: result.finalPrice,
      discount: result.discount,
      promotion: promotion ? {
        id: promotion.id,
        name: promotion.name,
        type: promotion.type,
        displayText: getPromotionDisplayText(promotion)
      } : null
    });

    totalPromotionDiscount += result.discount;
  }

  return {
    itemPromotions,
    totalPromotionDiscount: Math.round(totalPromotionDiscount * 100) / 100
  };
}

export {
  db,
  categories,
  runQuery,
  getQuery,
  allQuery,
  dbReady,
  dbPath,
  JWT_SECRET,
  getProductSpecs,
  getProductSkus,
  getProductStock,
  getProductPriceRange,
  getProductPromotions,
  getAllActivePromotions,
  getProductActivePromotion,
  calculatePromotionPrice,
  getPromotionDisplayText,
  getAvailableCoupons,
  getUserCoupons,
  calculateCouponDiscount,
  getCouponDisplayText,
  calculateCartPromotions
};
