import type { AttachmentPayload, ComposerPayload, ProviderEvent, ProviderId } from '../shared/types';

const operationKeepAlive = new Map<string, { port: chrome.runtime.Port; timer: number; releaseLock?: () => void }>();
const operationPhases = new Map<string, 'sending' | 'monitoring' | 'completed' | 'error'>();
const terminalEvents = new Map<string, ProviderEvent>();
const terminalDeliveries = new Map<string, Promise<void>>();
const pendingDomChecks = new Set<() => void>();
const TERMINAL_KEY_PREFIX = 'multiAiRoundtableTerminal:';
const BASELINE_KEY_PREFIX = 'multiAiRoundtableResponseBaseline:';
const monitorActivity = new Map<string, number>();
const monitorResumes = new Map<string, Promise<void>>();
let replyAccelerationEnabled = true;
let pageFramesEnabled = false;
let lastFrameRenewal = 0;

function controlPageFrames(command: 'start' | 'stop'): void {
  if (!pageFramesEnabled) return;
  try { document.dispatchEvent(new CustomEvent('__multiAiRoundtableFramesControlV2', { detail: command })); } catch { /* best effort */ }
}

interface ResponseBaseline { provider: ProviderId; count: number; url: string }

export function noteMonitorActivity(operationId: string): void {
  monitorActivity.set(operationId, Date.now());
  if (Date.now() - lastFrameRenewal >= 10000) {
    lastFrameRenewal = Date.now();
    controlPageFrames('start');
  }
}

export async function saveResponseBaseline(operationId: string, provider: ProviderId, count: number): Promise<void> {
  await chrome.storage.local.set({ [`${BASELINE_KEY_PREFIX}${operationId}`]: { provider, count, url: location.href } satisfies ResponseBaseline });
}

export async function confirmResponseBaseline(operationId: string): Promise<void> {
  const key = `${BASELINE_KEY_PREFIX}${operationId}`;
  const saved = await chrome.storage.local.get(key);
  const baseline = saved[key] as ResponseBaseline | undefined;
  if (baseline) await chrome.storage.local.set({ [key]: { ...baseline, url: location.href } });
}

export async function restoreResponseBaseline(operationId: string, provider: ProviderId, readCount: () => number): Promise<number> {
  const saved = await chrome.storage.local.get(`${BASELINE_KEY_PREFIX}${operationId}`);
  const baseline = saved[`${BASELINE_KEY_PREFIX}${operationId}`] as ResponseBaseline | undefined;
  if (!baseline || baseline.provider !== provider || !Number.isInteger(baseline.count) || baseline.count < 0) {
    throw new Error('无法确认当前网页回复属于本次操作，已停止恢复监听以免误收旧回答；请中断后继续');
  }
  // A reloaded SPA may expose its composer before restoring the conversation.
  // Keep the ownership check, but allow its route and message list to settle.
  const deadline = Date.now() + 12000;
  let stableSince = 0;
  let lastCount = -1;
  while (Date.now() < deadline) {
    noteMonitorActivity(operationId);
    const count = readCount();
    if (baseline.url === location.href && count >= baseline.count) {
      if (!stableSince || count !== lastCount) stableSince = Date.now();
      if (stableSince && Date.now() - stableSince >= 1000) return baseline.count;
    } else stableSince = 0;
    lastCount = count;
    await sleep(500);
  }
  throw new Error('网页会话或回复列表尚未恢复，无法确认本次回答；请中断后继续');
}

function checkDomNow(): void {
  for (const check of [...pendingDomChecks]) check();
}

function nudgeProviderPage(): void {
  // Managed tabs stay in the background for private game modes. Provider
  // frontends often gate a pending composer/render pass on these lifecycle
  // events even when their DOM is already present.
  try { document.dispatchEvent(new Event('visibilitychange')); } catch { /* no-op */ }
  try { window.dispatchEvent(new Event('focus')); } catch { /* no-op */ }
  checkDomNow();
}

function beginOperationKeepAlive(operationId?: string): void {
  if (!operationId || operationKeepAlive.has(operationId)) return;
  try {
    const port = chrome.runtime.connect({ name: 'provider-operation' });
    const ping = () => {
      try { port.postMessage({ type: 'keepalive', operationId }); } catch { /* port closed */ }
    };
    ping();
    const timer = window.setInterval(ping, 15000);
    const lease: { port: chrome.runtime.Port; timer: number; releaseLock?: () => void } = { port, timer };
    operationKeepAlive.set(operationId, lease);
    controlPageFrames('start');
    // An operation port keeps the extension alive, but not the webpage.
    // Hold a private Web Lock while this page has real pending work so Chrome
    // Energy Saver does not freeze its network, render and monitor tasks.
    if (navigator.locks) {
      void navigator.locks.request(`multi-ai-roundtable:${crypto.randomUUID()}`, async () => {
        if (operationKeepAlive.get(operationId) !== lease) return;
        await new Promise<void>((resolve) => { lease.releaseLock = resolve; });
      }).catch(() => undefined);
    }
    port.onDisconnect.addListener(() => {
      const current = operationKeepAlive.get(operationId);
      if (!current || current.port !== port) return;
      window.clearInterval(current.timer);
      current.releaseLock?.();
      operationKeepAlive.delete(operationId);
      if (!operationKeepAlive.size) controlPageFrames('stop');
    });
  } catch {
    // Best-effort keepalive only. Provider execution itself must not fail because of it.
  }
}

function endOperationKeepAlive(operationId?: string): void {
  if (!operationId) return;
  const current = operationKeepAlive.get(operationId);
  if (!current) return;
  window.clearInterval(current.timer);
  current.releaseLock?.();
  try { current.port.disconnect(); } catch { /* already disconnected */ }
  operationKeepAlive.delete(operationId);
  if (!operationKeepAlive.size) controlPageFrames('stop');
}

export function emitProviderEvent(event: ProviderEvent): void {
  if (event.operationId) beginOperationKeepAlive(event.operationId);
  if (event.operationId && (event.type === 'PROVIDER_RESPONSE_COMPLETED' || event.type === 'PROVIDER_ERROR')) {
    operationPhases.set(event.operationId, event.type === 'PROVIDER_ERROR' ? 'error' : 'completed');
    terminalEvents.set(event.operationId, event);
    void deliverTerminalEvent(event);
    return;
  }
  chrome.runtime.sendMessage({ source: 'provider-content', event }).catch(() => undefined);
}

async function deliverTerminalEvent(event: ProviderEvent): Promise<void> {
  const operationId = event.operationId!;
  const existing = terminalDeliveries.get(operationId);
  if (existing) return existing;
  const delivery = (async () => {
    const key = `${TERMINAL_KEY_PREFIX}${operationId}`;
    await chrome.storage.local.set({ [key]: event }).catch(() => undefined);
    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        const response = await chrome.runtime.sendMessage({ source: 'provider-content', event });
        if (response?.success === true) {
          await chrome.storage.local.remove([key, `${BASELINE_KEY_PREFIX}${operationId}`]).catch(() => undefined);
          terminalEvents.delete(operationId);
          monitorActivity.delete(operationId);
          endOperationKeepAlive(operationId);
          return;
        }
      } catch { /* The persisted terminal event is replayed on the next background check. */ }
      await sleep(Math.min(1000 * 2 ** attempt, 15000));
    }
    endOperationKeepAlive(operationId);
  })();
  terminalDeliveries.set(operationId, delivery);
  try { await delivery; } finally { terminalDeliveries.delete(operationId); }
}

export async function requestProviderWake(operationId: string): Promise<void> {
  const response = await chrome.runtime.sendMessage({ type: 'WAKE_PROVIDER_OPERATION', operationId });
  if (response?.success !== true) throw new Error(response?.error || '无法唤醒当前 AI 标签页');
  checkDomNow();
}

export async function releaseProviderWake(operationId: string): Promise<void> {
  await chrome.runtime.sendMessage({ type: 'RELEASE_PROVIDER_WAKE', operationId }).catch(() => undefined);
}

export function composerTextMatches(actual: string, expected: string): boolean {
  // contenteditable can render paragraph separators as two or three newlines.
  const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
  return normalize(actual) === normalize(expected);
}

export async function confirmProviderSubmission(operationId: string, options: {
  submitted: () => boolean;
  retry: () => void;
  current: () => boolean;
  attemptTimeoutMs?: number;
}): Promise<void> {
  let woke = false;
  try {
    nudgeProviderPage();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const deadline = Date.now() + (options.attemptTimeoutMs ?? 2500);
      while (Date.now() < deadline) {
        if (!options.current()) throw new Error('AI 操作已中断');
        if (options.submitted()) return;
        await waitForDomMutation(250);
      }
      if (!options.current()) throw new Error('AI 操作已中断');
      if (options.submitted()) return;
      if (attempt === 2) break;
      nudgeProviderPage();
      if (!woke) { await requestProviderWake(operationId); woke = true; }
      if (!options.current()) throw new Error('AI 操作已中断');
      if (options.submitted()) return;
      options.retry();
    }
    throw new Error('网页没有确认本次消息已发送，停止接力以免重复发送');
  } finally { if (woke) await releaseProviderWake(operationId); }
}

export function visible(element: Element | null): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false;
  const style = getComputedStyle(element);
  // Background tabs can have valid, fully-updated DOM while Chrome defers layout,
  // which makes getClientRects() temporarily empty until the tab is activated.
  // Provider automation must reason about DOM availability, not foreground layout.
  if (!element.isConnected || style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    if (parent.hidden || getComputedStyle(parent).display === 'none') return false;
  }
  return true;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function waitForDomMutation(timeoutMs = 1000): Promise<void> {
  const root = document.documentElement;
  if (!root) return sleep(timeoutMs);
  return new Promise((resolve) => {
    let settled = false;
    let timer = 0;
    const finish = () => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      window.clearTimeout(timer);
      pendingDomChecks.delete(finish);
      resolve();
    };
    const observer = new MutationObserver(finish);
    observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true });
    pendingDomChecks.add(finish);
    timer = window.setTimeout(finish, timeoutMs);
  });
}

export const PROVIDER_MONITOR_MAX_MS = 30 * 60 * 1000;

export function responseCompletionReady(options: {
  lastChangeAt: number;
  explicitComplete?: boolean;
  generationActive?: boolean;
  observedGenerationComplete?: boolean;
  visibleFallbackMs?: number;
  hiddenFallbackMs?: number;
}): boolean {
  if (options.generationActive) return false;
  const quietFor = Date.now() - options.lastChangeAt;
  if ((options.explicitComplete || (replyAccelerationEnabled && options.observedGenerationComplete)) && quietFor >= 1000) return true;
  const fallbackMs = document.visibilityState === 'hidden'
    ? (options.hiddenFallbackMs ?? 20000)
    : (options.visibleFallbackMs ?? 15000);
  return quietFor >= fallbackMs;
}

export function dataUrlToFile(attachment: AttachmentPayload): File {
  const [head, body] = attachment.dataUrl.split(',', 2);
  const mime = /data:([^;]+)/.exec(head)?.[1] || attachment.type || 'application/octet-stream';
  const binary = atob(body ?? '');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], attachment.name, { type: mime });
}

export function setFileInputFiles(input: HTMLInputElement, attachments: AttachmentPayload[]): void {
  if (!attachments.length) return;
  const transfer = new DataTransfer();
  attachments.forEach((attachment) => transfer.items.add(dataUrlToFile(attachment)));
  input.files = transfer.files;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

export function latestText(selectors: string[]): string {
  for (const selector of selectors) {
    const elements = [...document.querySelectorAll(selector)].filter(visible);
    const last = elements.at(-1);
    const text = last?.textContent?.trim();
    if (text) return text;
  }
  return '';
}

function normalizeText(value: string): string {
  return value.replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function escapeInline(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/([*_`])/g, '\\$1');
}

function nodeToMarkdown(node: Node, listDepth = 0): string {
  if (node.nodeType === Node.TEXT_NODE) return escapeInline(node.textContent ?? '');
  if (!(node instanceof HTMLElement)) return '';

  const tag = node.tagName.toLowerCase();
  const children = () => [...node.childNodes].map((child) => nodeToMarkdown(child, listDepth)).join('');

  if (tag === 'br') return '\n';
  if (/^h[1-6]$/.test(tag)) return `${'#'.repeat(Number(tag[1]))} ${normalizeText(children())}\n\n`;
  if (tag === 'p') return `${normalizeText(children())}\n\n`;
  if (tag === 'strong' || tag === 'b') return `**${normalizeText(children())}**`;
  if (tag === 'em' || tag === 'i') return `*${normalizeText(children())}*`;
  if (tag === 'del' || tag === 's') return `~~${normalizeText(children())}~~`;
  if (tag === 'code' && node.parentElement?.tagName.toLowerCase() !== 'pre') return `\`${(node.textContent ?? '').replace(/`/g, '\\`')}\``;
  if (tag === 'pre') {
    const code = node.textContent ?? '';
    const language = node.querySelector('code')?.className.match(/language-([\w-]+)/)?.[1] ?? '';
    return `\n\n\`\`\`${language}\n${code.replace(/\n$/, '')}\n\`\`\`\n\n`;
  }
  if (tag === 'a') {
    const label = normalizeText(children()) || node.getAttribute('href') || '';
    const href = node.getAttribute('href') || '';
    return href ? `[${label}](${href})` : label;
  }
  if (tag === 'img') {
    const src = node.getAttribute('src') || '';
    const alt = escapeInline(node.getAttribute('alt') || '图片');
    return src ? `![${alt}](${src})` : alt;
  }
  if (tag === 'blockquote') {
    return `${normalizeText(children()).split('\n').map((line) => `> ${line}`).join('\n')}\n\n`;
  }
  if (tag === 'ul' || tag === 'ol') {
    const ordered = tag === 'ol';
    const items = [...node.children].filter((child) => child.tagName.toLowerCase() === 'li');
    return items.map((item, index) => {
      const body = normalizeText([...item.childNodes].map((child) => nodeToMarkdown(child, listDepth + 1)).join(''));
      const prefix = ordered ? `${index + 1}. ` : '- ';
      const indent = '  '.repeat(listDepth);
      return `${indent}${prefix}${body.replace(/\n/g, `\n${indent}  `)}`;
    }).join('\n') + '\n\n';
  }
  if (tag === 'table') {
    const rows = [...node.querySelectorAll('tr')].map((row) => [...row.querySelectorAll(':scope > th, :scope > td')].map((cell) => normalizeText(nodeToMarkdown(cell)).replace(/\|/g, '\\|')));
    if (!rows.length) return '';
    const width = Math.max(...rows.map((row) => row.length));
    const header = [...rows[0], ...Array(Math.max(0, width - rows[0].length)).fill('')];
    const body = rows.slice(1).map((row) => [...row, ...Array(Math.max(0, width - row.length)).fill('')]);
    return `| ${header.join(' | ')} |\n| ${header.map(() => '---').join(' | ')} |\n${body.map((row) => `| ${row.join(' | ')} |`).join('\n')}\n\n`;
  }
  if (tag === 'hr') return '\n---\n\n';
  if (tag === 'li' || tag === 'td' || tag === 'th') return children();
  if (['div', 'section', 'article', 'main'].includes(tag)) return children();
  return children();
}

export function elementToMarkdown(element: Element | null): string {
  if (!(element instanceof HTMLElement)) return '';
  const clone = element.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('button, time, [data-testid^="message_action_"], [data-testid="audio_play_button"]').forEach((item) => item.remove());
  return normalizeText(nodeToMarkdown(clone));
}

export function setContentEditableText(input: HTMLElement, text: string): void {
  input.focus();
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(input);
  selection?.removeAllRanges();
  selection?.addRange(range);
  document.execCommand('delete');
  document.execCommand('insertText', false, text);
  input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

export function setTextareaText(input: HTMLTextAreaElement, text: string): void {
  input.focus();
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  if (setter) setter.call(input, text);
  else input.value = text;
  input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

export interface ProviderHarnessOptions {
  provider: ProviderId;
  send: (payload: ComposerPayload, operationId: string) => Promise<void>;
  cancel: (operationId?: string) => Promise<void>;
  resumeMonitor?: (operationId: string) => Promise<void>;
  ready?: () => boolean | Promise<boolean>;
}

export function installProviderHarness(options: ProviderHarnessOptions): void {
  const marker = `__multiAiRoundtableProvider_${options.provider}_v2`;
  const scope = globalThis as typeof globalThis & Record<string, unknown>;
  const installed = scope[marker] as { listener?: Parameters<typeof chrome.runtime.onMessage.addListener>[0] } | undefined;
  // Extension reload can leave a marker in the page after invalidating its
  // message listener. Only a listener registered in this runtime is reusable.
  if (installed?.listener && chrome.runtime.onMessage.hasListener(installed.listener)) return;
  emitProviderEvent({ type: 'PROVIDER_READY', provider: options.provider });
  const listener: Parameters<typeof chrome.runtime.onMessage.addListener>[0] = (message, _sender, sendResponse) => {
    if (typeof message?.replyAcceleration === 'boolean') replyAccelerationEnabled = message.replyAcceleration;
    if (typeof message?.pageFramePump === 'boolean') {
      if (pageFramesEnabled && !message.pageFramePump) controlPageFrames('stop');
      pageFramesEnabled = message.pageFramePump;
    }
    if (message?.type === 'PROVIDER_CONFIG') {
      sendResponse({ success: true });
      return false;
    }
    if (message?.type === 'PROVIDER_PING') {
      if (!options.ready) {
        sendResponse({ success: true, provider: options.provider, protocolVersion: 2 });
        return false;
      }
      Promise.resolve(options.ready())
        .then((ready) => sendResponse({ success: Boolean(ready), provider: options.provider, protocolVersion: 2 }))
        .catch(() => sendResponse({ success: false, provider: options.provider }));
      return true;
    }
    if (message?.type === 'PROVIDER_SEND') {
      const operationId = String(message.operationId ?? crypto.randomUUID());
      if (operationPhases.has(operationId)) {
        checkDomNow();
        sendResponse({ success: true, phase: operationPhases.get(operationId) });
        return false;
      }
      operationPhases.set(operationId, 'sending');
      beginOperationKeepAlive(operationId);
      options.send(message.payload as ComposerPayload, operationId)
        .then(() => {
          if (operationPhases.get(operationId) === 'sending') operationPhases.set(operationId, 'monitoring');
          sendResponse({ success: true, phase: operationPhases.get(operationId) });
        })
        .catch((error: unknown) => {
          const text = error instanceof Error ? error.message : String(error);
          emitProviderEvent({ type: 'PROVIDER_ERROR', provider: options.provider, operationId, error: text });
          sendResponse({ success: false, error: text });
        });
      return true;
    }
    if (message?.type === 'PROVIDER_CANCEL') {
      options.cancel(message.operationId)
        .then(() => {
          endOperationKeepAlive(message.operationId);
          operationPhases.delete(message.operationId);
          sendResponse({ success: true });
        })
        .catch((error: unknown) => sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) }));
      return true;
    }
    if (message?.type === 'PROVIDER_CHECK' || message?.type === 'PROVIDER_RESUME_MONITOR') {
      const operationId = String(message.operationId ?? '');
      void (async () => {
        checkDomNow();
        const key = `${TERMINAL_KEY_PREFIX}${operationId}`;
        const saved = await chrome.storage.local.get(key);
        const terminal = terminalEvents.get(operationId) ?? saved[key] as ProviderEvent | undefined;
        if (terminal) {
          emitProviderEvent(terminal);
          return { success: true, phase: 'terminal' };
        }
        const phase = operationPhases.get(operationId);
        if (phase && (phase !== 'monitoring' || !replyAccelerationEnabled || Date.now() - (monitorActivity.get(operationId) ?? 0) < 30000)) return { success: true, phase };
        if (!options.resumeMonitor) return { success: false, error: '当前网页不支持恢复监听' };
        operationPhases.set(operationId, 'monitoring');
        beginOperationKeepAlive(operationId);
        try {
          let resume = monitorResumes.get(operationId);
          if (!resume) {
            noteMonitorActivity(operationId);
            resume = options.resumeMonitor(operationId);
            monitorResumes.set(operationId, resume);
          }
          try { await resume; } finally { if (monitorResumes.get(operationId) === resume) monitorResumes.delete(operationId); }
          return { success: true, phase: operationPhases.get(operationId), resumed: true };
        } catch (error) {
          operationPhases.delete(operationId);
          endOperationKeepAlive(operationId);
          emitProviderEvent({ type: 'PROVIDER_ERROR', provider: options.provider, operationId, error: error instanceof Error ? error.message : String(error) });
          throw error;
        }
      })().then(sendResponse).catch((error: unknown) => sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) }));
      return true;
    }
    return false;
  };
  chrome.runtime.onMessage.addListener(listener);
  scope[marker] = { listener };
}
