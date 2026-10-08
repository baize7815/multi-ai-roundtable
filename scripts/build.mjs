import { build, context } from 'esbuild';
import { mkdir, rm, copyFile, cp, access } from 'node:fs/promises';
import { dirname } from 'node:path';

const watch = process.argv.includes('--watch');

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function copyDirIfPresent(source, target) {
  if (await exists(source)) await cp(source, target, { recursive: true });
}

const entries = {
  background: 'src/background.ts',
  'sidepanel/app': 'src/sidepanel/controller.ts',
  'content/doubao': 'src/content/doubao.ts',
  'content/doubao-bootstrap': 'src/content/doubao-bootstrap.ts',
  'content/provider-bootstrap': 'src/content/provider-bootstrap.ts',
  'content/page-liveness': 'src/content/page-liveness.ts',
  'content/deepseek': 'src/content/deepseek.ts',
  'content/kimi': 'src/content/kimi.ts',
  'content/qwen': 'src/content/qwen.ts',
  'content/zhipu': 'src/content/zhipu.ts',
  'content/gpt': 'src/content/gpt.ts',
  'content/gemini': 'src/content/gemini.ts',
  'content/grok': 'src/content/grok.ts',
  'content/wenxin': 'src/content/wenxin.ts',
  'content/minimax': 'src/content/minimax.ts',
  'content/minimax-bootstrap': 'src/content/minimax-bootstrap.ts'
};

async function copyStatic() {
  await mkdir('dist/sidepanel', { recursive: true });
  await copyFile('manifest.json', 'dist/manifest.json');
  await copyFile('src/game-background.html', 'dist/game-background.html');
  await copyFile('src/sidepanel/index.html', 'dist/sidepanel/index.html');
  await copyFile('src/sidepanel/styles.css', 'dist/sidepanel/styles.css');
  await copyDirIfPresent('icon', 'dist/icon');
  if (await exists('LOGO')) await cp('LOGO', 'dist/LOGO', { recursive: true });
  else await copyDirIfPresent('old/LOGO', 'dist/LOGO');
  await copyDirIfPresent('SVG', 'dist/SVG');
}

const options = {
  entryPoints: Object.fromEntries(Object.entries(entries).filter(([name]) => !name.startsWith('content/'))),
  outdir: 'dist',
  bundle: true,
  format: 'esm',
  target: 'chrome120',
  sourcemap: false,
  logLevel: 'info'
};

// Content scripts may run through both the manifest and explicit injection.
// Their maps and operation variables must belong to one installation; an ESM
// bundle without exports is otherwise executed as a classic global script.
const contentOptions = {
  ...options,
  entryPoints: Object.fromEntries(Object.entries(entries).filter(([name]) => name.startsWith('content/'))),
  format: 'iife'
};

if (watch) {
  await mkdir('dist', { recursive: true });
  await copyStatic();
  const contexts = await Promise.all([context(options), context(contentOptions)]);
  await Promise.all(contexts.map((ctx) => ctx.watch()));
  console.log('Watching extension sources...');
} else {
  await rm('dist', { recursive: true, force: true });
  await mkdir('dist', { recursive: true });
  await Promise.all([build(options), build(contentOptions)]);
  await copyStatic();
}
