import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  findPython,
  isDocConvertLibsAvailable,
  isPythonRuntimeAvailable,
  spawnPython,
} from './python-runtime.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const BACKEND_DIR = process.env.PYTHON_SCRIPTS_DIR || path.join(ROOT, 'backend');
const CONVERT_CLI = path.join(BACKEND_DIR, 'convert_cli.py');

const CONVERT_EXTENSIONS = new Set(['.docx', '.pdf', '.html', '.htm', '.zip']);
const TEXT_EXTENSIONS = new Set(['.md', '.markdown', '.txt']);

let convertAvailableCache = null;

export function needsPythonConversion(ext) {
  return CONVERT_EXTENSIONS.has(String(ext || '').toLowerCase());
}

export function isTextExtension(ext) {
  return TEXT_EXTENSIONS.has(String(ext || '').toLowerCase());
}

export function isConvertAvailable() {
  if (convertAvailableCache !== null) return convertAvailableCache;
  convertAvailableCache = isPythonRuntimeAvailable(CONVERT_CLI) && isDocConvertLibsAvailable();
  return convertAvailableCache;
}

export function isZipUploadAvailable() {
  return isPythonRuntimeAvailable(CONVERT_CLI);
}

export function getSupportedFormats() {
  const base = {
    documents: ['.md', '.markdown', '.txt', '.docx', '.pdf', '.html', '.htm'],
    archives: ['.zip'],
    converter_available: isConvertAvailable(),
    zip_available: isZipUploadAvailable(),
    hints: {
      docx: 'Word 2007+ 文档，保留标题与段落结构',
      pdf: '按页提取文字并转为 Markdown；扫描版需 OCR',
      txt: '自动识别 UTF-8 / GBK 编码',
      zip: '项目包；包内 docx/pdf 会自动转为 md（需 Python）',
    },
  };
  if (!isZipUploadAvailable()) {
    base.hints.setup = 'zip/docx/pdf 需要 Python 3。zip 仅需 Python；docx/pdf 另需：pip install -r backend/requirements.txt';
  } else if (!isConvertAvailable()) {
    base.hints.setup = 'docx/pdf 转换需安装依赖：pip install -r backend/requirements.txt（zip 与 md/txt 可直接导入）';
  }
  return base;
}

/**
 * Convert an uploaded file via Python CLI. Returns { upload_type, converted, result }.
 */
export function convertUpload(workspace, filename, buffer, subdir = '正文') {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.zip') {
    if (!isZipUploadAvailable()) {
      throw new Error('zip 解压需要 Python 3。请安装 Python 并确保 python 在 PATH 中。');
    }
  } else if (!isConvertAvailable()) {
    throw new Error(
      'docx/pdf 转换需要 Python 依赖。请运行：pip install -r backend/requirements.txt',
    );
  }

  const tmpFile = path.join(
    os.tmpdir(),
    `ls-upload-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  fs.writeFileSync(tmpFile, buffer);

  try {
    const result = spawnPython(
      [
        CONVERT_CLI,
        '--workspace', workspace,
        '--filename', filename,
        '--subdir', subdir,
        '--data-file', tmpFile,
      ],
      {
        timeout: 120000,
        maxBuffer: 50 * 1024 * 1024,
      },
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
