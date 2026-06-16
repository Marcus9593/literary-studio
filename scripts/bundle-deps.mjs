#!/usr/bin/env node
/**
 * 文匠 Studio — 打包依赖脚本
 * 下载 Python 运行时、安装 Python 包、准备 Claude CLI
 */

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import https from 'https'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const VENDOR_DIR = path.join(ROOT, 'electron', 'vendor')

function run(cmd, opts = {}) {
  console.log(`  ▸ ${cmd}`)
  execSync(cmd, { cwd: ROOT, stdio: 'inherit', ...opts })
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`  ⬇ 下载: ${url}`)
    const file = fs.createWriteStream(dest)
    https.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        download(response.headers.location, dest).then(resolve).catch(reject)
        return
      }
      response.pipe(file)
      file.on('finish', () => {
        file.close()
        resolve()
      })
    }).on('error', (err) => {
      fs.unlink(dest, () => {})
      reject(err)
    })
  })
}

function isMachOBinary(filePath) {
  try {
    const head = fs.readFileSync(filePath).subarray(0, 4)
    return (
      (head[0] === 0xcf && head[1] === 0xfa && head[2] === 0xed && head[3] === 0xfe)
      || (head[0] === 0xfe && head[1] === 0xed && head[2] === 0xfa && head[3] === 0xce)
      || (head[0] === 0xfe && head[1] === 0xed && head[2] === 0xfa && head[3] === 0xcf)
    )
  } catch {
    return false
  }
}

function findNativeClaudeBinary(searchRoot) {
  const stack = [searchRoot]
  while (stack.length) {
    const dir = stack.pop()
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name)
      if (ent.isDirectory()) {
        if (ent.name === 'node_modules') stack.push(full)
        else if (!ent.name.startsWith('.')) stack.push(full)
        continue
      }
      if (ent.name !== 'claude' && ent.name !== 'claude.exe') continue
      if (isMachOBinary(full) || (process.platform === 'win32' && full.endsWith('.exe'))) {
        return full
      }
    }
  }
  return null
}

function resolveBuildPython() {
  const candidates = [
    '/opt/homebrew/bin/python3',
    '/usr/local/bin/python3',
  ]
  try {
    const which = execSync('which python3', { encoding: 'utf-8' }).trim()
    if (which && !candidates.includes(which)) candidates.push(which)
  } catch {}
  for (const c of candidates) {
    if (!fs.existsSync(c)) continue
    const probe = path.join(VENDOR_DIR, '.venv-probe')
    try {
      if (fs.existsSync(probe)) fs.rmSync(probe, { recursive: true, force: true })
      execSync(`"${c}" -m venv --copies "${probe}"`, { stdio: 'ignore' })
      fs.rmSync(probe, { recursive: true, force: true })
      return c
    } catch {}
  }
  return null
}

// ── Python 嵌入式运行时 ──

async function setupPython() {
  console.log('\n━━━ 设置 Python 运行时 ━━━')

  const pythonDir = path.join(VENDOR_DIR, 'python')
  const platform = process.platform

  if (platform === 'darwin') {
    const sysPython = resolveBuildPython()
    if (!sysPython) {
      console.warn('  ⚠️  未找到支持 venv --copies 的 Python，跳过 Python 打包（docx/pdf 导入将依赖系统 Python）')
      return
    }

    console.log('  使用 Python 创建独立环境...')
    console.log(`  使用 Python: ${sysPython}`)

    if (fs.existsSync(pythonDir)) {
      fs.rmSync(pythonDir, { recursive: true })
    }

    run(`"${sysPython}" -m venv --copies "${pythonDir}"`)

    // 升级 pip 并安装依赖
    const pythonBin = path.join(pythonDir, 'bin', 'python3')
    const requirements = path.join(ROOT, 'backend', 'requirements.txt')

    // 先升级 pip
    run(`"${pythonBin}" -m pip install --upgrade pip --trusted-host pypi.org --trusted-host files.pythonhosted.org`)

    // 安装依赖
    run(`"${pythonBin}" -m pip install --no-cache-dir --trusted-host pypi.org --trusted-host files.pythonhosted.org -r "${requirements}"`)

    console.log('  ✅ Python 运行时准备完成')

  } else if (platform === 'win32') {
    const version = '3.11.9'
    const url = `https://www.python.org/ftp/python/${version}/python-${version}-embed-amd64.zip`
    const zipPath = path.join(VENDOR_DIR, 'python-embed.zip')

    if (!fs.existsSync(pythonDir)) {
      fs.mkdirSync(pythonDir, { recursive: true })
      await download(url, zipPath)
      execSync(
        `powershell -NoProfile -Command "Expand-Archive -Path '${zipPath.replace(/'/g, "''")}' -DestinationPath '${pythonDir.replace(/'/g, "''")}' -Force"`,
        { stdio: 'inherit' },
      )
      fs.unlinkSync(zipPath)

      // 启用 pip
      const pthFile = fs.readdirSync(pythonDir).find(f => f.endsWith('._pth'))
      if (pthFile) {
        const pthPath = path.join(pythonDir, pthFile)
        let content = fs.readFileSync(pthPath, 'utf-8')
        content = content.replace('#import site', 'import site')
        fs.writeFileSync(pthPath, content)
      }

      // 下载 get-pip.py
      await download('https://bootstrap.pypa.io/get-pip.py', path.join(pythonDir, 'get-pip.py'))
      run(`"${path.join(pythonDir, 'python.exe')}" "${path.join(pythonDir, 'get-pip.py')}"`)

      // 安装依赖
      const requirements = path.join(ROOT, 'backend', 'requirements.txt')
      run(`"${path.join(pythonDir, 'python.exe')}" -m pip install --no-cache-dir -r "${requirements}"`)
    }

    console.log('  ✅ Python 运行时准备完成')
  }
}

// ── Claude CLI ──

async function setupClaudeCli() {
  console.log('\n━━━ 设置 Claude CLI ━━━')

  const claudeDir = path.join(VENDOR_DIR, 'claude')
  const platform = process.platform
  const arch = process.arch

  if (fs.existsSync(claudeDir)) {
    fs.rmSync(claudeDir, { recursive: true })
  }
  fs.mkdirSync(claudeDir, { recursive: true })

  const tmpDir = path.join(VENDOR_DIR, 'claude-tmp')
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true })
  }
  fs.mkdirSync(tmpDir, { recursive: true })

  const nativePkg = `@anthropic-ai/claude-code-${platform}-${arch}`
  fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
    name: 'claude-cli-bundle',
    private: true,
    dependencies: {
      '@anthropic-ai/claude-code': 'latest',
      [nativePkg]: 'latest',
    },
  }))

  console.log(`  安装 Claude CLI (${nativePkg})...`)
  try {
    run('npm install --omit=dev', { cwd: tmpDir })
  } catch (err) {
    console.warn('  ⚠️  Claude CLI 下载失败，将依赖系统 PATH 中的 claude 命令')
    console.warn(`     ${err.message}`)
    fs.rmSync(tmpDir, { recursive: true, force: true })
    return
  }

  const installScript = path.join(tmpDir, 'node_modules', '@anthropic-ai', 'claude-code', 'install.cjs')
  if (fs.existsSync(installScript)) {
    run(`node "${installScript}"`, { cwd: tmpDir })
  }

  const anthropicRoot = path.join(tmpDir, 'node_modules', '@anthropic-ai')
  const platformPkg = `claude-code-${platform}-${arch}`
  const preferred = path.join(anthropicRoot, platformPkg, 'bin', platform === 'win32' ? 'claude.exe' : 'claude')
  let src = fs.existsSync(preferred) ? preferred : findNativeClaudeBinary(path.join(tmpDir, 'node_modules'))

  if (!src) {
    console.warn(`  ⚠️  未找到 Claude CLI 原生二进制 (platform=${platform}, arch=${arch})，将依赖系统 claude 命令`)
    fs.rmSync(tmpDir, { recursive: true, force: true })
    return
  }

  const destName = platform === 'win32' ? 'claude.exe' : 'claude'
  const dest = path.join(claudeDir, destName)
  fs.copyFileSync(src, dest)
  fs.chmodSync(dest, 0o755)
  console.log(`  ✅ Claude CLI 二进制已复制: ${dest} (${fs.statSync(dest).size} bytes)`)

  fs.rmSync(tmpDir, { recursive: true })
  console.log('  ✅ Claude CLI 准备完成')
}

// ── 主流程 ──

async function main() {
  const args = process.argv.slice(2)
  const claudeOnly = args.includes('--claude-only')
  const pythonOnly = args.includes('--python-only')

  console.log('╔══════════════════════════════════════╗')
  console.log('║   文匠 Studio — 依赖打包脚本         ║')
  console.log('╚══════════════════════════════════════╝')

  if (!fs.existsSync(VENDOR_DIR)) {
    fs.mkdirSync(VENDOR_DIR, { recursive: true })
  }

  if (!claudeOnly) await setupPython()
  if (!pythonOnly) await setupClaudeCli()

  console.log('\n╔══════════════════════════════════════╗')
  console.log('║           依赖打包完成！              ║')
  console.log('╚══════════════════════════════════════╝')
  console.log(`\n输出目录: ${VENDOR_DIR}`)
}

main().catch(err => {
  console.error('打包失败:', err)
  process.exit(1)
})
