import { analyzeCharacter } from './analyze-character.js';
import { analyzeOutline } from './analyze-outline.js';
import { reviewContent } from './review-content.js';
import { generateContent } from './generate-content.js';

/** @type {Record<string, Function>} */
export const STEP_REGISTRY = {
  'analyze-character': analyzeCharacter,
  'analyze-outline': analyzeOutline,
  'review-content': reviewContent,
  'generate-content': generateContent,
};

export {
  analyzeCharacter,
  analyzeOutline,
  reviewContent,
  generateContent,
};

export default STEP_REGISTRY;
