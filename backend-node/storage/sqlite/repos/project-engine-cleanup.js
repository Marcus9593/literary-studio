import { deleteProjectCanonData } from './canon-repo.js';
import { deleteProjectPipelineData } from './pipeline-repo.js';
import { deleteProjectMemoryData } from './memory-facts-repo.js';
import { deleteProjectVoiceDnaData } from './voice-dna-repo.js';

export function deleteProjectEngineData(projectId) {
  deleteProjectCanonData(projectId);
  deleteProjectPipelineData(projectId);
  deleteProjectMemoryData(projectId);
  deleteProjectVoiceDnaData(projectId);
}
