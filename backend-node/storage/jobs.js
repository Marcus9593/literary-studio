import { randomUUID } from 'crypto';
import { JOBS_PATH, now, readJSON, writeJSON, sqlAdapter } from './core.js';

// ── Jobs ──

export function loadJobs() {
  return sqlAdapter.readKv(sqlAdapter.KV_KEYS.jobs, JOBS_PATH, {}, readJSON);
}
export function saveJobs(jobs) {
  sqlAdapter.writeKv(sqlAdapter.KV_KEYS.jobs, JOBS_PATH, jobs, writeJSON);
}

export function getJob(jobId) {
  const jobs = loadJobs();
  if (!jobs[jobId]) throw new Error(`任务不存在: ${jobId}`);
  return jobs[jobId];
}

export function createJob(projectId, jobType, params) {
  const jobId = randomUUID().slice(0, 16);
  const job = { id: jobId, project_id: projectId, type: jobType, params, status: 'queued', steps: [], result: null, error: null, created_at: now(), updated_at: now() };
  const jobs = loadJobs();
  jobs[jobId] = job;
  saveJobs(jobs);
  return job;
}

export function updateJob(jobId, fields) {
  const jobs = loadJobs();
  Object.assign(jobs[jobId], fields, { updated_at: now() });
  saveJobs(jobs);
  return jobs[jobId];
}

export function appendJobStep(jobId, step, status, detail = '') {
  const job = getJob(jobId);
  job.steps.push({ step, status, detail, at: now() });
  updateJob(jobId, { steps: job.steps });
}

