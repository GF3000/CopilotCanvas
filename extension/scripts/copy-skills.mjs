// Bundle the repo's Copilot CLI skills into the extension so a packaged .vsix is
// self-contained. Copies ../../.github/skills -> dist/skills (run after the esbuild
// step in the extension build). At setup time the extension copies these into
// ~/.copilot/skills/ so the /diagram* slash commands work in ANY project, not just
// this repo. The runtime (setup.ts) prefers this bundled copy and falls back to
// ../../.github/skills for the F5 dev host.
import { existsSync, rmSync, cpSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', '..', '.github', 'skills');
const dest = join(here, '..', 'dist', 'skills');

if (!existsSync(src)) {
  console.error(
    `[copy-skills] skills not found at ${src}. Expected the repo's .github/skills folder.`,
  );
  process.exit(1);
}

rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, { recursive: true });
console.log(`[copy-skills] bundled skills -> ${dest}`);
