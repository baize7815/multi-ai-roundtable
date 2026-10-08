import { build } from 'esbuild';
import { mkdir, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const dir = '.tmp-fog-council-tests';
await rm(dir, { recursive: true, force: true });
await mkdir(dir, { recursive: true });
try {
  await build({
    entryPoints: ['tests/fog-council-core.test.ts', 'tests/fog-council-engine.test.ts'],
    outdir: dir,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    logLevel: 'silent'
  });
  for (const name of ['fog-council-core.test','fog-council-engine.test']) {
    await import(pathToFileURL(resolve(dir, name+'.js')).href + '?t=' + Date.now());
  }
} finally {
  await rm(dir, { recursive: true, force: true });
}
