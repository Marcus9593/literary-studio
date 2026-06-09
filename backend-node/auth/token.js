import crypto from 'crypto';
import { JWT_SECRET, TOKEN_TTL_MS } from './constants.js';

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

function b64urlJson(obj) {
  return b64url(JSON.stringify(obj));
}

function parseB64urlJson(str) {
  return JSON.parse(Buffer.from(str, 'base64url').toString('utf-8'));
}

export function signToken(user) {
  const header = b64urlJson({ alg: 'HS256', typ: 'JWT' });
  const now = Date.now();
  const payload = b64urlJson({
    sub: user.id,
    username: user.username,
    role: user.role,
    display_name: user.display_name || user.username,
    iat: now,
    exp: now + TOKEN_TTL_MS,
  });
  const sig = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${sig}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, sig] = parts;
  const expected = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  let data;
  try {
    data = parseB64urlJson(payload);
  } catch {
    return null;
  }
  if (!data.sub || !data.exp || Date.now() > data.exp) return null;
  return {
    id: data.sub,
    username: data.username,
    role: data.role,
    display_name: data.display_name || data.username,
  };
}

export function extractBearerToken(req) {
  const header = String(req.headers.authorization || '');
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
}
