const Koa = require('koa');
const cors = require('@koa/cors');
const bodyParser = require('koa-bodyparser');
const net = require('net');
const productsRouter = require('./routes/products');
const healthRouter = require('./routes/health');
const { dbReady } = require('./database');
const config = require('../config');

const app = new Koa();
const PORT = config.backend.port;
const HOST = config.backend.host;

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

app.use(healthRouter.routes());
app.use(healthRouter.allowedMethods());

app.use(productsRouter.routes());
app.use(productsRouter.allowedMethods());

async function checkPortAvailable(port, host) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`端口 ${port} 已被占用，请释放端口或修改 config.js 中的端口配置`));
      } else {
        reject(err);
      }
    });
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port, host);
  });
}

async function startServer() {
  try {
    await checkPortAvailable(PORT, HOST);
    await dbReady;

    app.listen(PORT, HOST, () => {
      console.log('========================================');
      console.log(`  后端服务器启动成功!`);
      console.log(`  地址: http://${HOST}:${PORT}`);
      console.log(`  健康检查: http://${HOST}:${PORT}/api/health`);
      console.log(`  商品接口: http://${HOST}:${PORT}/api/products`);
      console.log('========================================');
    });
  } catch (err) {
    console.error('❌ 启动失败:', err.message);
    process.exit(1);
  }
}

startServer();
