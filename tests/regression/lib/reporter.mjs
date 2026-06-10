/** Minimal QA-style reporter for regression suites. */

export function createReporter(suiteName) {
  const results = [];

  function record(id, name, pass, detail = '') {
    results.push({ id, name, pass, detail });
    const mark = pass ? 'PASS' : 'FAIL';
    console.log(`[${mark}] ${id} ${name}${detail ? ` — ${detail}` : ''}`);
  }

  function summarize() {
    const passed = results.filter((r) => r.pass).length;
    const failed = results.filter((r) => !r.pass).length;
    console.log(`\n=== ${suiteName}: ${passed} 通过, ${failed} 失败, 共 ${results.length} 项 ===`);
    if (failed) {
      console.log('\n失败项:');
      for (const r of results.filter((x) => !x.pass)) {
        console.log(`  - ${r.id} ${r.name}: ${r.detail}`);
      }
      return { passed, failed, total: results.length, ok: false };
    }
    return { passed, failed, total: results.length, ok: true };
  }

  return { record, summarize, results };
}
