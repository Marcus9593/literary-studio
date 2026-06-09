/** Stub provider for future multi-model support */

export function createStubProvider(id, label) {
  return {
    id,
    async *stream(request) {
      yield {
        type: 'error',
        error: `${label} Provider 尚未实现。请在工具中心将 AI Runtime 设为 claude，或等待后续版本。`,
      };
      yield { type: 'done' };
    },
    async generate() {
      throw new Error(`${label} Provider 尚未实现`);
    },
    async checkHealth() {
      return { available: false, error: `${label} Provider 尚未实现`, provider: id };
    },
  };
}
