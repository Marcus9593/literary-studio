import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const ROOT = path.resolve(__dirname, '../..')
export const PKG_PATH = path.join(ROOT, 'package.json')

/** 发布版本唯一来源：根 package.json */
export function readVersion() {
  const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'))
  const version = String(pkg.version || '').trim()
  if (!version) throw new Error('package.json 缺少 version 字段')
  return version
}

export function parseVersion(version) {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:-([\w.]+))?$/.exec(version)
  if (!m) throw new Error(`无效版本号: ${version}`)
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    prerelease: m[4] || '',
    raw: version,
  }
}

export function bumpVersion(current, level) {
  const v = parseVersion(current)
  switch (level) {
    case 'major':
      return `${v.major + 1}.0.0`
    case 'minor':
      return `${v.major}.${v.minor + 1}.0`
    case 'patch':
      return `${v.major}.${v.minor}.${v.patch + 1}`
    default:
      throw new Error(`未知级别: ${level}（可用 patch | minor | major）`)
  }
}

export function writeJsonVersion(filePath, version) {
  const pkg = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  pkg.version = version
  fs.writeFileSync(filePath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8')
}
