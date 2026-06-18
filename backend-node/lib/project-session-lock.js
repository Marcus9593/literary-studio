/** Per-project FIFO lock — serializes session read-modify-write across WS / HTTP. */
const tails = new Map();
const holding = new Set();

export function withProjectSessionLock(projectId, fn) {
  const key = String(projectId || '');
  if (holding.has(key)) {
    return Promise.resolve().then(() => fn());
  }

  const prev = tails.get(key) ?? Promise.resolve();
  const job = prev
    .catch(() => {})
    .then(() => {
      holding.add(key);
      try {
        return fn();
      } finally {
        holding.delete(key);
      }
    });
  tails.set(key, job);
  return job.finally(() => {
    if (tails.get(key) === job) tails.delete(key);
  });
}
