const DIM = 384;

/**
 * Local embedding without external API — hash n-gram bag for similarity.
 * Replace with model embeddings when configured.
 */
export function embedText(text, dims = DIM) {
  const vec = new Float32Array(dims);
  const normalized = String(text || '').toLowerCase().replace(/\s+/g, ' ');
  if (!normalized) return Array.from(vec);

  for (let i = 0; i < normalized.length - 2; i++) {
    const tri = normalized.slice(i, i + 3);
    let h = 0;
    for (let j = 0; j < tri.length; j++) {
      h = (h * 31 + tri.charCodeAt(j)) >>> 0;
    }
    vec[h % dims] += 1;
  }

  let norm = 0;
  for (let i = 0; i < dims; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < dims; i++) vec[i] /= norm;

  return Array.from(vec);
}

export function cosineSimilarity(a, b) {
  if (!a?.length || !b?.length) return 0;
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom ? dot / denom : 0;
}

export { DIM as EMBEDDING_DIM };
