const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 20;

const buckets = new Map();

function clientKey(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function rateLimit(req, res, next) {
  const key = clientKey(req);
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || now - bucket.start > WINDOW_MS) {
    bucket = { start: now, count: 0 };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > MAX_ATTEMPTS) {
    return res.status(429).json({ error: '请求过于频繁，请稍后再试' });
  }
  return next();
}

export const authRateLimit = rateLimit;
export const loginRateLimit = rateLimit;

export function resetLoginRateLimit(req) {
  buckets.delete(clientKey(req));
}
