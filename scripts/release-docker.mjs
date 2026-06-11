#!/usr/bin/env node
/**
 * Build and publish literarycraft/studio Docker images.
 *
 * Usage:
 *   npm run docker:release
 *   npm run docker:release -- --target runtime-slim --tags slim
 *   npm run docker:release -- --dry-run
 *   npm run docker:release -- --no-push
 *
 * Env:
 *   IMAGE_REPO     default literarycraft/studio
 *   DOCKER_TARGET  runtime | runtime-slim (default runtime)
 *   APT_MIRROR     optional Debian mirror for full image build
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_REPO = process.env.IMAGE_REPO || 'literarycraft/studio';

function log(msg) {
  console.log(msg);
}

function fail(msg, code = 1) {
  console.error(`[release-docker] ${msg}`);
  process.exit(code);
}

function readVersion() {
  const pkgPath = path.join(ROOT, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const version = String(pkg.version || '').trim();
  if (!version) fail('package.json 缺少 version 字段');
  return version;
}

function parseArgs(argv) {
  const opts = {
    target: process.env.DOCKER_TARGET || 'runtime',
    repo: DEFAULT_REPO,
    dryRun: false,
    push: true,
    allowDirty: false,
    platforms: '',
    tags: [],
    aptMirror: process.env.APT_MIRROR || '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--no-push') opts.push = false;
    else if (arg === '--allow-dirty') opts.allowDirty = true;
    else if (arg === '--target') opts.target = argv[++i] || fail('--target 需要值');
    else if (arg === '--repo') opts.repo = argv[++i] || fail('--repo 需要值');
    else if (arg === '--platform') opts.platforms = argv[++i] || fail('--platform 需要值');
    else if (arg === '--apt-mirror') opts.aptMirror = argv[++i] || fail('--apt-mirror 需要值');
    else if (arg === '--tags') {
      const raw = argv[++i] || fail('--tags 需要逗号分隔的标签名');
      opts.tags = raw.split(',').map((t) => t.trim()).filter(Boolean);
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      fail(`未知参数: ${arg}（使用 --help 查看说明）`);
    }
  }

  if (!opts.tags.length) {
    opts.tags = opts.target === 'runtime-slim'
      ? ['slim', readVersion()]
      : [readVersion(), 'latest'];
  }

  return opts;
}

function printHelp() {
  log(`\
用法: npm run docker:release -- [选项]

选项:
  --target <name>       runtime（完整版，默认）| runtime-slim（精简版）
  --tags <a,b,c>        镜像标签，默认完整版: {version},latest；slim: slim,{version}
  --repo <name>         镜像仓库，默认 literarycraft/studio
  --platform <list>     多架构，如 linux/amd64,linux/arm64（需 buildx --push）
  --apt-mirror <host>   完整版构建时的 Debian 镜像源
  --no-push             只构建，不推送
  --dry-run             打印命令，不执行
  --allow-dirty         允许工作区有未提交改动
  -h, --help            显示帮助

示例:
  npm run docker:release
  npm run docker:release -- --target runtime-slim --tags slim,2.6.0-slim
  npm run docker:release -- --platform linux/amd64,linux/arm64
  npm run docker:release -- --dry-run --no-push
`);
}

function run(cmd, args, { inherit = false } = {}) {
  const printable = [cmd, ...args].join(' ');
  log(`\n> ${printable}`);
  const result = spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: inherit ? 'inherit' : 'pipe',
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    fail(stderr ? `${printable}\n${stderr}` : `命令失败: ${printable}`, result.status || 1);
  }
  return result.stdout?.trim() || '';
}

function ensureDocker() {
  run('docker', ['version'], { inherit: true });
}

function ensureGitClean(allowDirty) {
  if (allowDirty) {
    log('[release-docker] 跳过 git 干净检查（--allow-dirty）');
    return;
  }
  const status = run('git', ['status', '--porcelain']);
  if (status) {
    fail('工作区有未提交改动，请先 commit 或使用 --allow-dirty');
  }
}

function ensureBuildx(opts) {
  if (!opts.platforms) return;
  run('docker', ['buildx', 'version'], { inherit: true });
  const inspect = spawnSync('docker', ['buildx', 'inspect', 'literarycraft-builder'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  if (inspect.status !== 0) {
    run('docker', ['buildx', 'create', '--name', 'literarycraft-builder', '--use'], { inherit: true });
  } else {
    run('docker', ['buildx', 'use', 'literarycraft-builder'], { inherit: true });
  }
}

function imageRef(repo, tag) {
  return `${repo}:${tag}`;
}

function buildImages(opts, version) {
  const primaryTag = imageRef(opts.repo, opts.tags[0]);
  const buildArgs = [];
  if (opts.aptMirror) {
    buildArgs.push('--build-arg', `APT_MIRROR=${opts.aptMirror}`);
  }

  if (opts.platforms) {
    const tagFlags = opts.tags.flatMap((tag) => ['-t', imageRef(opts.repo, tag)]);
    const args = [
      'buildx', 'build',
      '--platform', opts.platforms,
      '--target', opts.target,
      ...buildArgs,
      ...tagFlags,
      ...(opts.push ? ['--push'] : ['--load']),
      '.',
    ];
    if (opts.dryRun) {
      log(`[dry-run] docker ${args.join(' ')}`);
      return primaryTag;
    }
    run('docker', args, { inherit: true });
    return primaryTag;
  }

  const args = [
    'build',
    '--target', opts.target,
    ...buildArgs,
    '-t', primaryTag,
    '.',
  ];
  if (opts.dryRun) {
    log(`[dry-run] docker ${args.join(' ')}`);
  } else {
    run('docker', args, { inherit: true });
  }

  for (let i = 1; i < opts.tags.length; i += 1) {
    const extra = imageRef(opts.repo, opts.tags[i]);
    const tagArgs = ['tag', primaryTag, extra];
    if (opts.dryRun) {
      log(`[dry-run] docker ${tagArgs.join(' ')}`);
    } else {
      run('docker', tagArgs);
    }
  }

  return primaryTag;
}

function pushImages(opts) {
  if (!opts.push || opts.platforms) return;
  for (const tag of opts.tags) {
    const ref = imageRef(opts.repo, tag);
    if (opts.dryRun) {
      log(`[dry-run] docker push ${ref}`);
    } else {
      run('docker', ['push', ref], { inherit: true });
    }
  }
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const version = readVersion();

  log('文匠 Studio — Docker 发布');
  log(`版本: ${version}`);
  log(`目标: ${opts.target}`);
  log(`镜像: ${opts.repo}`);
  log(`标签: ${opts.tags.join(', ')}`);
  if (opts.platforms) log(`架构: ${opts.platforms}`);
  if (opts.dryRun) log('模式: dry-run');
  if (!opts.push) log('推送: 关闭（--no-push）');

  if (opts.dryRun) {
    ensureGitClean(opts.allowDirty);
    buildImages(opts, version);
    pushImages(opts);
    log('\n[dry-run] 完成。去掉 --dry-run 后执行真实构建。');
    return;
  }

  ensureDocker();
  ensureGitClean(opts.allowDirty);
  ensureBuildx(opts);

  if (opts.push && !opts.platforms) {
    log('\n[release-docker] 推送前请确认已登录: docker login');
  }

  buildImages(opts, version);
  pushImages(opts);

  log('\n发布完成。');
  for (const tag of opts.tags) {
    log(`  docker pull ${imageRef(opts.repo, tag)}`);
  }
  log('\n服务器更新:');
  log('  cd /opt/literary-studio && ./deploy/docker/upgrade.sh');
}

main();
