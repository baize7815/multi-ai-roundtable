import { build } from 'esbuild';
import { mkdir, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const tempDir = '.tmp-werewolf-tests';
const testEntries = ['werewolf-core.test', 'werewolf-engine.test', 'orchestrator-regression.test', 'expert-transfer.test', 'reply-foreground.test', 'qiniu-presets.test', 'attachment-store.test', 'provider-events.test', 'provider-recovery-check.test', 'private-game-submission.test', 'game-reply-timing.test', 'private-game-focus.test', 'clocktower-phase-guide.test', 'clocktower-day-progression.test'];

await rm(tempDir, { recursive: true, force: true });
await mkdir(tempDir, { recursive: true });

try {
  await build({
    entryPoints: testEntries.map((name) => `tests/${name}.ts`),
    outdir: tempDir,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    logLevel: 'silent'
  });
  for (const name of testEntries) {
    await import(`${pathToFileURL(resolve(`${tempDir}/${name}.js`)).href}?t=${Date.now()}`);
  }
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
