import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  isDocConvertLibsAvailable,
  isPythonRuntimeAvailable,
  probeDocConvertLibsAvailable,
  spawnPythonAsync,
} from './python-runtime.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STUDIO_ROOT = path.join(__dirname, '..', '..');
const BACKEND_DIR = process.env.PYTHON_SCRIPTS_DIR || path.join(STUDIO_ROOT, 'backend');
const CONVERT_CLI = path.join(BACKEND_DIR, 'convert_cli.py');

const CONVERT_EXTENSIONS = new Set(['.docx', '.pdf', '.html', '.htm', '.zip']);
const TEXT_EXTENSIONS = new Set(['.md', '.markdown', '.txt']);

let convertAvailableCache = null;
let convertAvailableProbe = null;

export function needsPythonConversion(ext) {
  return CONVERT_EXTENSIONS.has(String(ext || '').toLowerCase());
}

export function isTextExtension(ext) {
  return TEXT_EXTENSIONS.has(String(ext || '').toLowerCase());
}

export function isConvertAvailable() {
  return convertAvailableCache ?? false;
}

export async function probeConvertAvailable() {
  if (convertAvailableCache !== null) return convertAvailableCache;
  if (!convertAvailableProbe) {
    convertAvailableProbe = (async () => {
      const ok = isPythonRuntimeAvailable(CONVERT_CLI) && await probeDocConvertLibsAvailable();
      convertAvailableCache = ok;
      return ok;
    })();
  }
  return convertAvailableProbe;
}

export function isZipUploadAvailable() {
  return isPythonRuntimeAvailable(CONVERT_CLI);
}

export async function getSupportedFormats() {
  const converterAvailable = await probeConvertAvailable();
  const base = {
    documents: ['.md', '.markdown', '.txt', '.docx', '.pdf', '.html', '.htm'],
    archives: ['.zip'],
    converter_available: converterAvailable,
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
  } else if (!converterAvailable && !isDocConvertLibsAvailable()) {
    base.hints.setup = 'docx/pdf 转换需安装依赖：pip install -r backend/requirements.txt（zip 与 md/txt 可直接导入）';
  }
  return base;
}

/**
 * Convert an uploaded file via Python CLI. Returns { upload_type, converted, result }.
 */
export async function convertUpload(workspace, filename, buffer, subdir = '正文') {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.zip') {
    if (!isZipUploadAvailable()) {
      throw new Error('zip 解压需要 Python 3。请安装 Python 并确保 python 在 PATH 中。');
    }
  } else if (!(await probeConvertAvailable())) {
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
    const result = await spawnPythonAsync(
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
