import Koa from 'koa';
import cors from '@koa/cors';
import bodyParser from 'koa-bodyparser';
import productsRouter from '../routes/products.js';
import authRouter from '../routes/auth.js';
import reviewsRouter from '../routes/reviews.js';
import cartsRouter from '../routes/carts.js';
import ordersRouter from '../routes/orders.js';
import healthRouter from '../routes/health.js';
import searchRouter from '../routes/search.js';
import recommendationsRouter from '../routes/recommendations.js';
import { router as stockAlertsRouter } from '../routes/stockAlerts.js';
import favoritesRouter from '../routes/favorites.js';
import promotionsRouter from '../routes/promotions.js';
import couponsRouter from '../routes/coupons.js';
import { createCache } from '../cache.js';

function createTestApp() {
  const app = new Koa();

  createCache({ defaultTTL: 5 * 60 * 1000 });

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

  app.use(favoritesRouter.routes());
  app.use(favoritesRouter.allowedMethods());

  app.use(promotionsRouter.routes());
  app.use(promotionsRouter.allowedMethods());

  app.use(couponsRouter.routes());
  app.use(couponsRouter.allowedMethods());

  return app;
}

export { createTestApp };
