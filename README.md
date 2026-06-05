# 商品管理系统

基于 Node.js (Koa) + Vue 3 + SQLite 的商品管理应用。

## 技术栈

| 层级 | 技术 |
|------|------|
| **后端** | Node.js + Koa 2 + @libsql/client (原生 SQLite 驱动) |
| **前端** | Vue 3 (Composition API) + Vite + Axios |
| **数据库** | SQLite (原生嵌入式数据库，持久化到本地文件) |

## 项目结构

```
label-652/
├── backend/              # 后端服务
│   ├── routes/
│   │   ├── health.js     # 健康检查路由
│   │   └── products.js   # 商品 CRUD API
│   ├── database.js       # 数据库初始化与操作
│   ├── server.js         # Koa 服务器入口
│   └── package.json
├── frontend/             # 前端应用
│   ├── src/
│   │   ├── api/
│   │   │   └── products.js  # API 封装
│   │   ├── App.vue         # 主应用组件
│   │   ├── main.js         # 入口文件
│   │   └── style.css       # 全局样式
│   ├── vite.config.js      # Vite 配置
│   └── package.json
├── config.js             # 全局配置 (端口号等)
├── start.bat             # Windows 一键启动脚本
├── start.ps1             # PowerShell 一键启动脚本
├── .gitignore
└── README.md             # 本文档
```

## 快速开始

### 方式一：一键启动 (推荐)

**Windows 批处理：**
```bash
双击运行 start.bat
```

**PowerShell：**
```powershell
.\start.ps1
```

脚本会自动：
1. 检查并安装依赖
2. 启动后端服务 (端口 3000)
3. 启动前端服务 (端口 5173)

### 方式二：手动启动

**1. 安装后端依赖并启动：**
```bash
cd backend
npm install
npm start
```

**2. 安装前端依赖并启动 (新终端)：**
```bash
cd frontend
npm install
npm run dev
```

## 访问地址

启动成功后访问：
- **前端应用**: http://localhost:5173
- **后端 API**: http://localhost:3000
- **健康检查**: http://localhost:3000/api/health

## 功能特性

### 后端 API

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/health` | 健康检查 |
| `GET` | `/api/products` | 获取商品列表<br>参数: `category`(分类), `page`(页码), `limit`(每页数量) |
| `GET` | `/api/products/:id` | 获取单个商品详情 |
| `POST` | `/api/products` | 创建商品 |
| `PUT` | `/api/products/:id` | 更新商品 |
| `DELETE` | `/api/products/:id` | 删除商品 |
| `GET` | `/api/products/categories` | 获取分类列表 |

**商品字段：**
- `id` - 商品ID (自增)
- `name` - 商品名称 (必填)
- `description` - 商品描述
- `price` - 价格 (必填)
- `category` - 分类 (必填: 电子产品/服装/食品/家居/图书/运动)
- `stock` - 库存 (默认 0)
- `image` - 图片链接
- `created_at` - 创建时间
- `updated_at` - 更新时间

### 前端功能

1. **商品列表展示** - 卡片式布局，展示商品图片、名称、描述、价格、库存
2. **分类筛选** - 支持按 6 个分类筛选，切换后自动刷新列表
3. **分页功能** - 每页 12 条，支持上一页/下一页
4. **商品管理** - 添加、编辑、删除商品
5. **图片占位** - 无图片或加载失败时显示默认占位图
6. **智能提示** - 新增商品时若分类与当前筛选不一致，提示切换分类查看
7. **交互体验** - 加载动画、Toast 消息提示、操作确认弹窗

## 配置说明

端口配置在 [config.js](file:///F:/Lcj/0602/label-652/config.js) 中统一管理：

```javascript
const config = {
  backend: {
    port: 3000,      // 后端端口
    host: 'localhost'
  },
  frontend: {
    port: 5173,      // 前端端口
    host: 'localhost'
  }
};
```

修改配置后需重启服务生效。

### 端口占用处理

- 后端启动时会自动检查端口是否被占用
- 若端口被占用，会给出明确错误提示：
  ```
  ❌ 启动失败: 端口 3000 已被占用，请释放端口或修改 config.js 中的端口配置
  ```
- 前端设置 `strictPort: true`，端口被占用时直接报错退出

## 数据库说明

- 使用 **@libsql/client** 原生嵌入式 SQLite 驱动
- 数据持久化到 `backend/products.db` 文件
- 首次启动自动创建表并插入 16 条示例数据
- 数据库文件已加入 `.gitignore`，不会提交到版本库

### 重置数据库

如需重置数据，删除数据库文件后重启后端：
```bash
cd backend
del products.db
npm start
```

## 分类说明

系统预置 6 个商品分类：
- 电子产品
- 服装
- 食品
- 家居
- 图书
- 运动

## 开发说明

### 后端开发模式
```bash
cd backend
npm run dev    # 使用 nodemon 自动重启
```

### 前端构建
```bash
cd frontend
npm run build    # 生产构建
npm run preview  # 预览构建结果
```

## 常见问题

**Q: 端口被占用怎么办？**
A: 修改 `config.js` 中的端口号，或停止占用端口的程序。

**Q: 后端启动失败提示缺少 Visual Studio？**
A: 本项目使用 `@libsql/client` 原生驱动，无需编译环境。如仍有问题，请检查 Node.js 版本 (建议 >= 18)。

**Q: 前端图片加载失败？**
A: 系统会自动显示默认占位图，不影响功能使用。

**Q: 新增商品后在列表中看不到？**
A: 检查当前分类筛选是否与商品分类一致，系统会提示是否切换到对应分类查看。
