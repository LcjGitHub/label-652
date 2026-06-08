import Koa from 'koa';
import cors from '@koa/cors';
import bodyParser from 'koa-bodyparser';
import net from 'net';
import productsRouter from './routes/products.js';
import authRouter from './routes/auth.js';
import reviewsRouter from './routes/reviews.js';
import cartsRouter from './routes/carts.js';
import ordersRouter from './routes/orders.js';
import healthRouter from './routes/health.js';
import searchRouter from './routes/search.js';
import recommendationsRouter from './routes/recommendations.js';
import { router as stockAlertsRouter } from './routes/stockAlerts.js';
import { dbReady } from './database.js';
import config from '../config.js';

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

app.use(authRouter.routes());
app.use(authRouter.allowedMethods());

app.use(reviewsRouter.routes());
app.use(reviewsRouter.allowedMethods());

app.use(cartsRouter.routes());
app.use(cartsRouter.allowedMethods());

app.use(ordersRouter.routes());
app.use(ordersRouter.allowedMethods());

app.use(productsRouter.routes());
app.use(productsRouter.allowedMethods());

app.use(searchRouter.routes());
app.use(searchRouter.allowedMethods());

app.use(recommendationsRouter.routes());
app.use(recommendationsRouter.allowedMethods());

app.use(stockAlertsRouter.routes());
app.use(stockAlertsRouter.allowedMethods());

async function checkPortAvailable(port, host) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`端口 ${port} 已被占用，请释放端口或修改 config.json 中的端口配置`));
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
      console.log(`  用户接口: http://${HOST}:${PORT}/api/auth`);
      console.log(`  评价接口: http://${HOST}:${PORT}/api/reviews`);
      console.log(`  购物车接口: http://${HOST}:${PORT}/api/cart`);
      console.log(`  订单接口: http://${HOST}:${PORT}/api/orders`);
      console.log(`  搜索接口: http://${HOST}:${PORT}/api/search`);
      console.log(`  推荐接口: http://${HOST}:${PORT}/api/recommendations`);
      console.log(`  库存预警接口: http://${HOST}:${PORT}/api/stock-alerts`);
      console.log('========================================');
    });
  } catch (err) {
    console.error('❌ 启动失败:', err.message);
    process.exit(1);
  }
}

startServer();
