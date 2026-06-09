import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const DATA_DIR = process.env.LITERARY_STUDIO_DATA || path.join(ROOT, 'data');

/** V2.8 目标存储根（Phase C 前仅路径约定，读写仍走 verify/ + studio） */
export function measurementDir(projectId) {
  return path.join(DATA_DIR, 'projects', projectId, 'measurement');
}

export const MEASUREMENT_SEGMENTS = {
  review: 'review',
  verify: 'verify',
  metrics: 'metrics',
  trends: 'trends',
};

export function measurementPath(projectId, segment, filename) {
  return path.join(measurementDir(projectId), segment, filename);
}

export function reviewLatestPath(projectId) {
  return measurementPath(projectId, MEASUREMENT_SEGMENTS.review, 'latest.json');
}

export function metricsProjectPath(projectId) {
  return measurementPath(projectId, MEASUREMENT_SEGMENTS.metrics, 'project.json');
}

export function trendsSeriesPath(projectId) {
  return measurementPath(projectId, MEASUREMENT_SEGMENTS.trends, 'series.json');
}
