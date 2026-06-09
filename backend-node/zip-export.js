import fs from 'fs';
import path from 'path';
import archiver from 'archiver';

/**
 * Zip workspace directory without relying on system `zip` CLI.
 */
export function createWorkspaceZip(sourceDir, outputPath) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve(outputPath));
    output.on('error', reject);
    archive.on('error', reject);

    archive.pipe(output);
    archive.glob('**/*', {
      cwd: sourceDir,
      dot: false,
      ignore: ['**/.DS_Store'],
    });
    archive.finalize();
  });
}
