const { createClient } = require('@libsql/client');
const config = require('../config');
const bcrypt = require('bcryptjs');

const dbPath = config.database.path;
const JWT_SECRET = config.jwt?.secret || 'your-secret-key-change-in-production';

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

  await db.execute(`
    CREATE TABLE IF NOT EXISTS carts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      UNIQUE(user_id, product_id)
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

module.exports = { db, categories, runQuery, getQuery, allQuery, dbReady, dbPath, JWT_SECRET };
