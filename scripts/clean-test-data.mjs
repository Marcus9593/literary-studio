#!/usr/bin/env node
/**
 * 清理开发/测试产生的本地数据（不清理 release 产物）。
 *
 * 用法:
 *   node scripts/clean-test-data.mjs
 *   node scripts/clean-test-data.mjs --appdata   # 同时清理 Electron userData/data
 */
import {
  cleanRepoTestData,
  cleanElectronUserData,
} from './clean-pack-environment.mjs'

const cleanAppData = process.argv.includes('--appdata')

console.log('清理项目内测试数据…')
const total = cleanRepoTestData()

if (cleanAppData) {
  cleanElectronUserData()
}

console.log(total ? `\n已清理 ${total} 项仓库数据。` : '\n无需清理（仓库目录已为空）。')
