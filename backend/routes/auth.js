import Router from 'koa-router';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { runQuery, getQuery, JWT_SECRET } from '../database.js';
import { authMiddleware } from '../middleware/auth.js';

const router = new Router({ prefix: '/api/auth' });

router.post('/register', async (ctx) => {
  const { username, email, password, avatar } = ctx.request.body;

  if (!username || !email || !password) {
    ctx.status = 400;
    ctx.body = { success: false, message: '用户名、邮箱和密码为必填项' };
    return;
  }

  if (password.length < 6) {
    ctx.status = 400;
    ctx.body = { success: false, message: '密码长度至少为6位' };
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    ctx.status = 400;
    ctx.body = { success: false, message: '邮箱格式不正确' };
    return;
  }

  const existingUser = await getQuery('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
  if (existingUser) {
    ctx.status = 400;
    ctx.body = { success: false, message: '用户名或邮箱已存在' };
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const defaultAvatar = avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(username)}`;

  const result = await runQuery(`
    INSERT INTO users (username, email, password, avatar)
    VALUES (?, ?, ?, ?)
  `, [username, email, hashedPassword, defaultAvatar]);

  const user = await getQuery('SELECT id, username, email, avatar, created_at FROM users WHERE id = ?', [result.lastID]);

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

  ctx.status = 201;
  ctx.body = {
    success: true,
    data: {
      user,
      token
    }
  };
});

router.post('/login', async (ctx) => {
  const { email, password } = ctx.request.body;

  if (!email || !password) {
    ctx.status = 400;
    ctx.body = { success: false, message: '邮箱和密码为必填项' };
    return;
  }

  const user = await getQuery('SELECT * FROM users WHERE email = ?', [email]);
  if (!user) {
    ctx.status = 401;
    ctx.body = { success: false, message: '邮箱或密码错误' };
    return;
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    ctx.status = 401;
    ctx.body = { success: false, message: '邮箱或密码错误' };
    return;
  }

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

  const { password: _, ...userWithoutPassword } = user;

  ctx.body = {
    success: true,
    data: {
      user: userWithoutPassword,
      token
    }
  };
});

router.get('/profile', authMiddleware, async (ctx) => {
  ctx.body = {
    success: true,
    data: ctx.state.user
  };
});

router.put('/profile', authMiddleware, async (ctx) => {
  const { username, email, avatar } = ctx.request.body;
  const userId = ctx.state.user.id;

  const existing = await getQuery('SELECT * FROM users WHERE id = ?', [userId]);
  if (!existing) {
    ctx.status = 404;
    ctx.body = { success: false, message: '用户不存在' };
    return;
  }

  if (email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      ctx.status = 400;
      ctx.body = { success: false, message: '邮箱格式不正确' };
      return;
    }
    const emailExists = await getQuery('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId]);
    if (emailExists) {
      ctx.status = 400;
      ctx.body = { success: false, message: '邮箱已被使用' };
      return;
    }
  }

  if (username) {
    const usernameExists = await getQuery('SELECT id FROM users WHERE username = ? AND id != ?', [username, userId]);
    if (usernameExists) {
      ctx.status = 400;
      ctx.body = { success: false, message: '用户名已被使用' };
      return;
    }
  }

  const updateFields = [];
  const updateValues = [];

  if (username !== undefined) { updateFields.push('username = ?'); updateValues.push(username); }
  if (email !== undefined) { updateFields.push('email = ?'); updateValues.push(email); }
  if (avatar !== undefined) { updateFields.push('avatar = ?'); updateValues.push(avatar); }

  updateFields.push('updated_at = CURRENT_TIMESTAMP');
  updateValues.push(userId);

  await runQuery(`
    UPDATE users SET ${updateFields.join(', ')}
    WHERE id = ?
  `, updateValues);

  const updatedUser = await getQuery('SELECT id, username, email, avatar, created_at FROM users WHERE id = ?', [userId]);

  ctx.body = { success: true, data: updatedUser };
});

export default router;
