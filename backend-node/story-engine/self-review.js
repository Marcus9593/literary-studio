const START_TAG = '<self_review>';
const END_TAG = '</self_review>';

export function extractSelfReview(output) {
  const text = String(output || '');
  const startIdx = text.indexOf(START_TAG);
  const endIdx = text.indexOf(END_TAG);

  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    return { script: text.trim(), self_review: '' };
  }

  const script = text.slice(0, startIdx).trim();
  const reviewStart = startIdx + START_TAG.length;
  const self_review = text.slice(reviewStart, endIdx).trim();

  return { script, self_review };
}

export function hasSelfReview(output) {
  const text = String(output || '');
  return text.includes(START_TAG) && text.includes(END_TAG);
}
