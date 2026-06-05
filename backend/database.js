const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

let db;

const categories = ['电子产品', '服装', '食品', '家居', '图书', '运动'];
const dbPath = path.join(__dirname, 'products.db');

async function initDatabase() {
  const SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
    console.log('已加载现有数据库');
  } else {
    db = new SQL.Database();
    console.log('已创建新数据库');
  }

  db.run(`
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

  const countResult = db.exec('SELECT COUNT(*) as count FROM products');
  const count = countResult[0]?.values[0]?.[0] || 0;
  
  if (count === 0) {
    const sampleProducts = [
      ['iPhone 15', '最新款苹果手机，搭载 A17 芯片', 6999, '电子产品', 50, 'https://picsum.photos/seed/iphone15/300/200'],
      ['MacBook Pro', '14英寸专业笔记本电脑', 14999, '电子产品', 30, 'https://picsum.photos/seed/macbook/300/200'],
      ['AirPods Pro', '主动降噪无线耳机', 1899, '电子产品', 100, 'https://picsum.photos/seed/airpods/300/200'],
      ['运动T恤', '纯棉透气运动上衣', 99, '服装', 200, 'https://picsum.photos/seed/tshirt/300/200'],
      ['牛仔裤', '经典直筒牛仔长裤', 299, '服装', 150, 'https://picsum.photos/seed/jeans/300/200'],
      ['运动鞋', '轻便透气跑步鞋', 599, '服装', 80, 'https://picsum.photos/seed/shoes/300/200'],
      ['有机牛奶', '全脂纯牛奶 1L装', 15, '食品', 500, 'https://picsum.photos/seed/milk/300/200'],
      ['进口巧克力', '比利时黑巧克力礼盒', 128, '食品', 60, 'https://picsum.photos/seed/chocolate/300/200'],
      ['速溶咖啡', '阿拉比卡冻干咖啡粉', 68, '食品', 300, 'https://picsum.photos/seed/coffee/300/200'],
      ['北欧台灯', 'LED护眼阅读台灯', 258, '家居', 45, 'https://picsum.photos/seed/lamp/300/200'],
      ['收纳盒', '多功能塑料收纳箱', 45, '家居', 120, 'https://picsum.photos/seed/storage/300/200'],
      ['香薰蜡烛', '天然大豆蜡香薰', 78, '家居', 90, 'https://picsum.photos/seed/candle/300/200'],
      ['JavaScript高级程序设计', '前端开发经典教材', 129, '图书', 75, 'https://picsum.photos/seed/jsbook/300/200'],
      ['活着', '余华经典文学作品', 39, '图书', 200, 'https://picsum.photos/seed/book/300/200'],
      ['瑜伽垫', '加厚防滑健身垫', 89, '运动', 150, 'https://picsum.photos/seed/yogamat/300/200'],
      ['哑铃套装', '可调节重量哑铃 20kg', 399, '运动', 40, 'https://picsum.photos/seed/dumbbell/300/200'],
    ];

    const insertSql = `
      INSERT INTO products (name, description, price, category, stock, image)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    for (const product of sampleProducts) {
      db.run(insertSql, product);
    }
    console.log('已插入示例数据');
    saveDatabase();
  }
}

function saveDatabase() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

function runQuery(sql, params = []) {
  db.run(sql, params);
  saveDatabase();
  
  const lastIdResult = db.exec('SELECT last_insert_rowid() as id');
  const lastID = lastIdResult[0]?.values[0]?.[0] || 0;
  const changesResult = db.exec('SELECT changes() as changes');
  const changes = changesResult[0]?.values[0]?.[0] || 0;
  
  return { lastID, changes };
}

function getQuery(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  
  let result = undefined;
  if (stmt.step()) {
    result = stmt.getAsObject();
  }
  stmt.free();
  
  return result;
}

function allQuery(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

const dbReady = initDatabase().catch(err => {
  console.error('数据库初始化失败:', err);
  throw err;
});

module.exports = { db, categories, runQuery, getQuery, allQuery, saveDatabase, dbReady };
