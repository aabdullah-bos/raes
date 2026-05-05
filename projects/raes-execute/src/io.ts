import { writeFileSync, renameSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomBytes } from 'node:crypto';

// Write content to a temp file in the same directory as the target, then
// rename atomically. This guarantees the target is never in a partial state.
// On any failure the temp file is cleaned up and an error is returned.
export function writeFileAtomic(
  absolutePath: string,
  content: string,
): { error?: string } {
  const dir = dirname(absolutePath);
  const tmpPath = join(dir, `.raes-tmp-${randomBytes(8).toString('hex')}`);

  try {
    writeFileSync(tmpPath, content, 'utf8');
    renameSync(tmpPath, absolutePath);
    return {};
  } catch (e) {
    try { unlinkSync(tmpPath); } catch { /* already gone or never written */ }
    return { error: `failed to write ${absolutePath}: ${String(e)}` };
  }
}
