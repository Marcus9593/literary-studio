import { extractBearerToken, verifyToken } from './token.js';
import { isAdmin } from './permissions.js';

export function isPublicApiPath(pathname) {
  if (pathname === '/health') return true;
  if (pathname === '/auth/login' || pathname.startsWith('/auth/login/')) return true;
  if (pathname === '/auth/register' || pathname.startsWith('/auth/register/')) return true;
  if (pathname.startsWith('/guestbook/media/')) return true;
  return false;
}

export function requireAuth(req, res, next) {
  if (isPublicApiPath(req.path)) return next();

  const token = extractBearerToken(req);
  const user = verifyToken(token);
  if (!user) {
    res.status(401).json({ error: '未登录或会话已过期' });
    return;
  }
  req.user = user;
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user || !isAdmin(req.user)) {
    res.status(403).json({ error: '需要超级管理员权限' });
    return;
  }
  next();
}
