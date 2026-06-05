const jwt = require('jsonwebtoken');
const { JWT_SECRET, getQuery } = require('../database');

async function authMiddleware(ctx, next) {
  const authHeader = ctx.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    ctx.status = 401;
    ctx.body = { success: false, message: '未提供认证令牌' };
    return;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await getQuery('SELECT id, username, email, avatar, created_at FROM users WHERE id = ?', [decoded.userId]);

    if (!user) {
      ctx.status = 401;
      ctx.body = { success: false, message: '用户不存在' };
      return;
    }

    ctx.state.user = user;
    await next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      ctx.status = 401;
      ctx.body = { success: false, message: '令牌已过期' };
    } else if (err.name === 'JsonWebTokenError') {
      ctx.status = 401;
      ctx.body = { success: false, message: '无效的令牌' };
    } else {
      ctx.status = 500;
      ctx.body = { success: false, message: '认证失败' };
    }
  }
}

async function optionalAuthMiddleware(ctx, next) {
  const authHeader = ctx.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await getQuery('SELECT id, username, email, avatar, created_at FROM users WHERE id = ?', [decoded.userId]);
      if (user) {
        ctx.state.user = user;
      }
    } catch (err) {
    }
  }

  await next();
}

module.exports = { authMiddleware, optionalAuthMiddleware };
