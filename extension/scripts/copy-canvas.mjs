// Bundle the built canvas web app into the extension so a packaged .vsix is
// self-contained. Copies ../canvas/dist -> dist/canvas (run after the esbuild
// step in the extension build). The runtime (canvasPanel.ts) prefers this
// bundled copy and falls back to ../canvas/dist for the F5 dev host.
import { existsSync, rmSync, cpSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', '..', 'canvas', 'dist');
const dest = join(here, '..', 'dist', 'canvas');

if (!existsSync(src)) {
  console.error(
    `[copy-canvas] canvas build not found at ${src}. Run the canvas build first ` +
      `(npm run build at the repo root builds all workspaces).`,
  );
  process.exit(1);
}

rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, { recursive: true });
console.log(`[copy-canvas] bundled canvas -> ${dest}`);
