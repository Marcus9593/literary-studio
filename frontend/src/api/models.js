import { request } from './client.js';

export const getSettings = () => request('/models')
export const saveSettings = (body) =>
  request('/settings', { method: 'PUT', body: JSON.stringify(body) })

export const listModels = () => request('/models')
export const createModel = (body) =>
  request('/models', { method: 'POST', body: JSON.stringify(body) })
export const updateModel = (id, body) =>
  request(`/models/${id}`, { method: 'PUT', body: JSON.stringify(body) })
export const deleteModel = (id) =>
  request(`/models/${id}`, { method: 'DELETE' })
export const activateModel = (id) =>
  request(`/models/${id}/activate`, { method: 'POST' })
export const testModel = (id) =>
  request(`/models/${id}/test`, { method: 'POST' })
export const testModelConfig = (body) =>
  request('/models/test', { method: 'POST', body: JSON.stringify(body) })
export const importCcSwitch = () => request('/models/import/cc-switch')
