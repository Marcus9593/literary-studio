import { Router } from 'express';
import {
  authenticate,
  createUser,
  deleteUser,
  listUsers,
  registerUser,
  updateUser,
} from './user-store.js';
import { signToken } from './token.js';
import { requireAdmin, requireAuth } from './middleware.js';
import { authRateLimit, loginRateLimit, resetLoginRateLimit } from './login-rate-limit.js';
import { isRegisterAllowed } from './env.js';

const router = Router();

router.post('/register', authRateLimit, (req, res) => {
  if (!isRegisterAllowed()) {
    return res.status(403).json({ error: '注册已关闭' });
  }
  try {
    const user = registerUser(req.body || {});
    const token = signToken(user);
    res.status(201).json({ token, user });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/login', loginRateLimit, (req, res) => {
  const { username, password } = req.body || {};
  if (!username?.trim() || !password) {
    return res.status(400).json({ error: '请输入用户名和密码' });
  }
  const user = authenticate(username, password);
  if (!user) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  resetLoginRateLimit(req);
  const token = signToken(user);
  res.json({ token, user });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.get('/users', requireAuth, requireAdmin, (_req, res) => {
  try {
    res.json(listUsers());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/users', requireAuth, requireAdmin, (req, res) => {
  try {
    const user = createUser(req.body || {});
    res.status(201).json(user);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.patch('/users/:id', requireAuth, requireAdmin, (req, res) => {
  try {
    res.json(updateUser(req.params.id, req.body || {}));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/users/:id', requireAuth, requireAdmin, (req, res) => {
  try {
    res.json(deleteUser(req.params.id));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
