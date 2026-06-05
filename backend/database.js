const { createClient } = require('@libsql/client');
const config = require('../config');

const dbPath = config.database.path;

const db = createClient({
  url: `file:${dbPath}`
});

const categories = ['电子产品', '服装', '食品', '家居', '图书', '运动'];

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

  const countResult = await db.execute('SELECT COUNT(*) as count FROM products');
  const count = countResult.rows[0].count;

  if (count === 0) {
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
    console.log('已插入示例数据');
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

module.exports = { db, categories, runQuery, getQuery, allQuery, dbReady, dbPath };
