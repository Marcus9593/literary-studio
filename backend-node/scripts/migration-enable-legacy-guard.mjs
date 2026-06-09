#!/usr/bin/env node
/**
 * 启用 legacy studio.json 写入冻结 — validate 通过后、Cleanup 前执行
 */
import { enableLegacyWriteGuard } from '../migration/legacy-write-guard.js';

const payload = enableLegacyWriteGuard();
console.log(JSON.stringify({ status: 'enabled', ...payload }, null, 2));
