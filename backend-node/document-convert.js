import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CONVERT_CLI = path.join(ROOT, 'backend', 'convert_cli.py');

const CONVERT_EXTENSIONS = new Set(['.docx', '.pdf', '.html', '.htm', '.zip']);
const TEXT_EXTENSIONS = new Set(['.md', '.markdown', '.txt']);

function findPython() {
  if (process.env.PYTHON) return process.env.PYTHON;
  const venvPython = path.join(ROOT, '.venv', 'bin', 'python3');
  if (fs.existsSync(venvPython)) return venvPython;
  return 'python3';
}

let convertAvailableCache = null;

export function needsPythonConversion(ext) {
  return CONVERT_EXTENSIONS.has(String(ext || '').toLowerCase());
}

export function isTextExtension(ext) {
  return TEXT_EXTENSIONS.has(String(ext || '').toLowerCase());
}

export function isConvertAvailable() {
  if (convertAvailableCache !== null) return convertAvailableCache;
  const py = findPython();
  if (!fs.existsSync(CONVERT_CLI)) {
    convertAvailableCache = false;
    return false;
  }
  try {
    const probe = spawnSync(py, ['-c', 'import mammoth, fitz'], {
      encoding: 'utf-8',
      timeout: 8000,
    });
    convertAvailableCache = probe.status === 0;
  } catch {
    convertAvailableCache = false;
  }
  return convertAvailableCache;
}

export function getSupportedFormats() {
  const base = {
    documents: ['.md', '.markdown', '.txt', '.docx', '.pdf', '.html', '.htm'],
    archives: ['.zip'],
    converter_available: isConvertAvailable(),
    hints: {
      docx: 'Word 2007+ 文档，保留标题与段落结构',
      pdf: '按页提取文字并转为 Markdown；扫描版需 OCR',
      txt: '自动识别 UTF-8 / GBK 编码',
      zip: '项目包；包内 docx/pdf 会自动转为 md',
    },
  };
  if (!isConvertAvailable()) {
    base.hints.setup = '安装 Python 依赖后可转换 docx/pdf/zip：pip install -r backend/requirements.txt';
  }
  return base;
}

/**
 * Convert an uploaded file via Python CLI. Returns { upload_type, converted, result }.
 */
export function convertUpload(workspace, filename, buffer, subdir = '正文') {
  if (!isConvertAvailable()) {
    throw new Error(
      'docx/pdf/zip 转换需要 Python 环境。请运行：pip install -r backend/requirements.txt',
    );
  }

  const py = findPython();
  const tmpFile = path.join(
    os.tmpdir(),
    `ls-upload-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  fs.writeFileSync(tmpFile, buffer);

  try {
    const result = spawnSync(
      py,
      [
        CONVERT_CLI,
        '--workspace', workspace,
        '--filename', filename,
        '--subdir', subdir,
        '--data-file', tmpFile,
      ],
      { encoding: 'utf-8', timeout: 120000, maxBuffer: 50 * 1024 * 1024 },
    );

    const stdout = result.stdout?.trim() || '';
    const stderr = result.stderr?.trim() || '';

    if (result.status !== 0) {
      let message = stderr || stdout;
      try {
        const errJson = JSON.parse(stderr || stdout);
        message = errJson.error || message;
      } catch {}
      throw new Error(message || '文档转换失败');
    }

    return JSON.parse(stdout);
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
}
