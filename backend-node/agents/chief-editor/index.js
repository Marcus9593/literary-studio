/**
 * 总编辑 — 仅负责 route() 委托，业务在 planner / diagnosis / execution agent
 */
import * as storage from '../../storage.js';
import {
  classifyIntent,
  delegateAgentForIntent,
} from './intents.js';
import { buildStoryContextBlocks } from './context.js';
import { routePlannerIntent } from '../planner-agent/index.js';
import { routeDiagnosisIntent } from '../diagnosis-agent/index.js';
import {
  resolvePlanExecutionFromMessage,
  routeExecutionIntent,
  buildPlanExecuteRoute,
  buildPlanExecuteRouteForHttp,
  prepareConfirmedPlan,
  resolvePlanExecuteRoute,
  completePlan,
  afterChapterWritten,
} from '../execution-agent/index.js';

export { classifyIntent, buildStoryContextBlocks };
export {
  buildPlanExecuteRoute,
  buildPlanExecuteRouteForHttp,
  prepareConfirmedPlan,
  resolvePlanExecuteRoute,
  completePlan,
  afterChapterWritten,
};

export async function routeRequest(projectId, message, context = {}) {
  const planRoute = resolvePlanExecutionFromMessage(projectId, message);
  if (planRoute) return planRoute;

  const intent = classifyIntent(message);
  const agent = delegateAgentForIntent(intent);

  if (agent === 'planner') {
    const routed = routePlannerIntent(projectId, message, intent);
    if (routed) return routed;
  }

  if (agent === 'diagnosis') {
    const routed = routeDiagnosisIntent(projectId, message, intent);
    if (routed) return routed;
  }

  if (agent === 'execution') {
    const routed = routeExecutionIntent(projectId, message, intent);
    if (routed) return routed;
  }

  const meta = storage.normalizeProjectMeta(storage.getProject(projectId));
  return {
    action: 'chat',
    contextBlocks: buildStoryContextBlocks(projectId),
    intent,
    project: meta,
  };
}
