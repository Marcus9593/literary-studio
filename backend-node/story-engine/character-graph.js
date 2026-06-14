import { loadKnowledgeBundle } from '../story-kb/store.js';

/**
 * Build force-directed graph data from KB characters + relationships.
 */
export function buildCharacterGraph(projectId) {
  const kb = loadKnowledgeBundle(projectId);
  const characters = kb.characters?.items || [];
  const relations = kb.relationships?.items || [];

  const nameToId = new Map();
  const nameCount = new Map();
  const nodes = characters.map((c, i) => {
    let name = c.name;
    if (name && nameCount.has(name)) {
      const count = nameCount.get(name) + 1;
      nameCount.set(name, count);
      const suffixName = `${name}_${count}`;
      console.warn(`[character-graph] 重名角色检测: "${name}" 已存在，重命名为 "${suffixName}"`);
      name = suffixName;
    } else if (name) {
      nameCount.set(name, 1);
    }
    const id = c.id || name || `char_${i}`;
    nameToId.set(name, id);
    if (c.id) nameToId.set(c.id, id);
    return {
      id,
      name,
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
