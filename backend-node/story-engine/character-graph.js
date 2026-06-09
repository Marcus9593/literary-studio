import { loadKnowledgeBundle } from '../story-kb/store.js';

/**
 * Build force-directed graph data from KB characters + relationships.
 */
export function buildCharacterGraph(projectId) {
  const kb = loadKnowledgeBundle(projectId);
  const characters = kb.characters?.items || [];
  const relations = kb.relationships?.items || [];

  const nameToId = new Map();
  const nodes = characters.map((c, i) => {
    const id = c.id || c.name || `char_${i}`;
    nameToId.set(c.name, id);
    if (c.id) nameToId.set(c.id, id);
    return {
      id,
      name: c.name,
      role: c.role || '',
      arc_stage: c.arc_stage || 'setup',
    };
  });

  const edges = [];
  for (const rel of relations) {
    const source = rel.source_id || nameToId.get(rel.source) || rel.source;
    const target = rel.target_id || nameToId.get(rel.target) || rel.target;
    if (!source || !target) continue;
    edges.push({
      source,
      target,
      type: rel.relation_type || rel.type || 'related',
      score: rel.score ?? 0,
      label: rel.notes || rel.relation_type || '',
    });
  }

  return { nodes, edges };
}
