import Router from 'koa-router';

const router = new Router();

router.get('/api/health', async (ctx) => {
  ctx.body = {
    success: true,
    message: '商品管理 API 运行正常',
    timestamp: new Date().toISOString()
  };
});

export default router;
