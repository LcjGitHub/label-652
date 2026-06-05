const Koa = require('koa');
const cors = require('@koa/cors');
const bodyParser = require('koa-bodyparser');
const productsRouter = require('./routes/products');
const { dbReady } = require('./database');

const app = new Koa();
const PORT = process.env.PORT || 4000;

app.use(cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization']
}));

app.use(bodyParser());

app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    ctx.status = err.status || 500;
    ctx.body = {
      success: false,
      message: err.message || '服务器内部错误'
    };
    ctx.app.emit('error', err, ctx);
  }
});

app.use(productsRouter.routes());
app.use(productsRouter.allowedMethods());

app.use(async (ctx) => {
  if (ctx.path === '/api/health') {
    ctx.body = { success: true, message: '商品管理 API 运行正常' };
  }
});

async function startServer() {
  await dbReady;
  app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log(`健康检查: http://localhost:${PORT}/api/health`);
    console.log(`商品接口: http://localhost:${PORT}/api/products`);
  });
}

startServer();
