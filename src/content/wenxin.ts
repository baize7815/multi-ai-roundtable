import { noteMonitorActivity,
  elementToMarkdown,
  emitProviderEvent,
  confirmProviderSubmission,
  installProviderHarness,
  PROVIDER_MONITOR_MAX_MS,
  responseCompletionReady,
  setTextareaText,
  sleep,
  visible,
  waitForDomMutation
} from './common';
import type { ComposerPayload } from '../shared/types';

const PROVIDER = 'wenxin' as const;
const MONITOR_STORAGE_PREFIX = 'multiAiRoundtableWenxin:';
const INPUT_SELECTORS = [
  '#chat-textarea',
  'textarea.ci-textarea',
  'textarea[placeholder*="提问"]',
  'textarea[placeholder*="消息"]'
];

interface MonitorMarker {
  operationId: string;
  sentText: string;
  beforeUrl: string;
  baselinePairs: number;
  phase: 'sending' | 'monitoring';
}

let activeOperationId: string | null = null;
let monitorAbort = 0;

function normalized(value: string): string {
  return value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function findInput(): HTMLTextAreaElement {
  for (const selector of INPUT_SELECTORS) {
    const input = [...document.querySelectorAll(selector)].find((item) => item instanceof HTMLTextAreaElement && visible(item));
    if (input instanceof HTMLTextAreaElement) return input;
  }
  throw new Error('找不到文心输入框');
}

function qaPairs(): HTMLElement[] {
  return [...document.querySelectorAll('.chat-qa-container')].filter(visible) as HTMLElement[];
}

function questionText(pair: HTMLElement): string {
  return pair.querySelector<HTMLElement>('.cs-rank[data-query]')?.getAttribute('data-query')?.trim()
    || pair.querySelector<HTMLElement>('.cs-question-bubble, [data-query]')?.getAttribute('data-query')?.trim()
    || '';
}

function answerElement(pair: HTMLElement): HTMLElement | null {
  const markdown = [...pair.querySelectorAll('.ai-entry-block.ai-markdown, .cosd-markdown-content, .cs-answer-container')]
    .filter(visible)
    .at(-1);
  return markdown instanceof HTMLElement ? markdown : null;
}

function readResponse(pair: HTMLElement): string {
  return elementToMarkdown(answerElement(pair));
}

function pairLooksComplete(pair: HTMLElement): boolean {
  const statuses = [
    pair.getAttribute('data-chat-status'),
    pair.querySelector('.cs-answer-container')?.getAttribute('data-status'),
    pair.querySelector('.cs-hover-menu[data-status]')?.getAttribute('data-status')
  ].filter(Boolean).map((value) => String(value).toUpperCase());
  return statuses.some((status) => ['COMPLETE', 'COMPLETED', 'DONE', 'SUCCESS'].includes(status));
}

function generationActive(pair: HTMLElement | null): boolean {
  if (!pair) return false;
  const statuses = [
    pair.getAttribute('data-chat-status'),
    pair.querySelector('.cs-answer-container')?.getAttribute('data-status')
  ].filter(Boolean).map((value) => String(value).toUpperCase());
  if (statuses.some((status) => ['GENERATING', 'STREAMING', 'PENDING', 'LOADING'].includes(status))) return true;
  const visibleBusyControl = [...pair.querySelectorAll('[class*="loading"], [class*="generating"]')].some(visible);
  return visibleBusyControl && !pairLooksComplete(pair);
}

function findPair(marker: MonitorMarker): HTMLElement | null {
  const pairs = qaPairs();
  const samePage = location.href === marker.beforeUrl;
  const candidates = pairs.filter((pair, index) => {
    if (samePage && index < marker.baselinePairs) return false;
    return !marker.sentText || normalized(questionText(pair)) === normalized(marker.sentText);
  });
  return candidates.at(-1) ?? null;
}

function markerKey(operationId: string): string {
  return `${MONITOR_STORAGE_PREFIX}${operationId}`;
}

function parseMarker(value: unknown, operationId: string): MonitorMarker | null {
  if (!value || typeof value !== 'object') return null;
  const parsed = value as Partial<MonitorMarker>;
  if (parsed.operationId !== operationId
    || typeof parsed.sentText !== 'string'
    || typeof parsed.beforeUrl !== 'string'
    || typeof parsed.baselinePairs !== 'number'
    || !Number.isInteger(parsed.baselinePairs)
    || parsed.baselinePairs < 0
    || (parsed.phase !== 'sending' && parsed.phase !== 'monitoring')) return null;
  return {
    operationId,
    sentText: parsed.sentText,
    beforeUrl: parsed.beforeUrl,
    baselinePairs: parsed.baselinePairs,
    phase: parsed.phase
  };
}

async function saveMarker(marker: MonitorMarker): Promise<void> {
  await chrome.storage.local.set({ [markerKey(marker.operationId)]: marker });
}

async function loadMarker(operationId: string): Promise<MonitorMarker | null> {
  try {
    const saved = await chrome.storage.local.get(markerKey(operationId));
    return parseMarker(saved[markerKey(operationId)], operationId);
  } catch {
    return null;
  }
}

async function clearMarker(operationId?: string): Promise<void> {
  if (!operationId) return;
  await chrome.storage.local.remove(markerKey(operationId)).catch(() => undefined);
}

function newPairAfterBaseline(marker: MonitorMarker): HTMLElement | null {
  const pairs = qaPairs();
  if (location.href === marker.beforeUrl) return pairs.slice(marker.baselinePairs).at(-1) ?? null;
  return pairs.at(-1) ?? null;
}

function submissionConfirmed(marker: MonitorMarker): boolean {
  if (findPair(marker)) return true;
  let input: HTMLTextAreaElement;
  try { input = findInput(); } catch { return false; }
  if (normalized(input.value)) return false;
  const pair = newPairAfterBaseline(marker);
  return Boolean(pair && answerElement(pair));
}

function triggerEnter(input: HTMLTextAreaElement): void {
  input.focus();
  const common = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true, composed: true };
  input.dispatchEvent(new KeyboardEvent('keydown', common));
  input.dispatchEvent(new KeyboardEvent('keyup', common));
}

function triggerSubmitControl(): boolean {
  const submit = [...document.querySelectorAll('.ci-submit-button')].find(visible);
  if (!(submit instanceof HTMLElement) || !visible(submit)) return false;
  submit.focus();
  const common = { bubbles: true, cancelable: true, composed: true };
  submit.dispatchEvent(new MouseEvent('mousedown', { ...common, buttons: 1 }));
  submit.dispatchEvent(new MouseEvent('mouseup', { ...common, buttons: 0 }));
  submit.click();
  return true;
}

async function monitorResponse(operationId: string, generation: number, marker: MonitorMarker): Promise<void> {
  let started = false;
  let last = '';
  let lastChangeAt = Date.now();
  const startedAt = Date.now();

  while (generation === monitorAbort && Date.now() - startedAt < PROVIDER_MONITOR_MAX_MS) {
    noteMonitorActivity(operationId);
    const pair = findPair(marker);
    const text = pair ? readResponse(pair) : '';
    if (!started) {
      if (!pair || !text) {
        await waitForDomMutation();
        continue;
      }
      started = true;
      last = text;
      lastChangeAt = Date.now();
      emitProviderEvent({ type: 'PROVIDER_RESPONSE_STARTED', provider: PROVIDER, operationId });
      emitProviderEvent({ type: 'PROVIDER_RESPONSE_DELTA', provider: PROVIDER, operationId, text });
      await waitForDomMutation();
      continue;
    }

    if (text && text !== last) {
      last = text;
      lastChangeAt = Date.now();
      emitProviderEvent({ type: 'PROVIDER_RESPONSE_DELTA', provider: PROVIDER, operationId, text });
    } else if (text && text === last) {
      if (responseCompletionReady({
        lastChangeAt,
        explicitComplete: Boolean(pair && pairLooksComplete(pair)),
        generationActive: generationActive(pair)
      })) {
        emitProviderEvent({ type: 'PROVIDER_RESPONSE_COMPLETED', provider: PROVIDER, operationId, text: last });
        if (activeOperationId === operationId) activeOperationId = null;
        await clearMarker(operationId);
        return;
      }
    }
    await waitForDomMutation();
  }

  if (generation === monitorAbort) {
    emitProviderEvent({ type: 'PROVIDER_ERROR', provider: PROVIDER, operationId, error: '文心监听超时，未确认回复生成结束' });
    await clearMarker(operationId);
  }
}

function startMonitor(operationId: string, generation: number, marker: MonitorMarker): void {
  void monitorResponse(operationId, generation, marker).catch((error: unknown) => {
    if (generation !== monitorAbort) return;
    emitProviderEvent({
      type: 'PROVIDER_ERROR',
      provider: PROVIDER,
      operationId,
      error: error instanceof Error ? error.message : String(error)
    });
    void clearMarker(operationId);
  });
}

async function send(payload: ComposerPayload, operationId: string): Promise<void> {
  if (payload.attachments.length) throw new Error('文心网页端附件入口由动态工具控制，当前版本仅支持文字转发');
  activeOperationId = operationId;
  monitorAbort += 1;
  const generation = monitorAbort;
  const input = findInput();
  const marker: MonitorMarker = {
    operationId,
    sentText: payload.text,
    beforeUrl: location.href,
    baselinePairs: qaPairs().length,
    phase: 'sending'
  };
  await saveMarker(marker);
  setTextareaText(input, payload.text);
  await sleep(150);
  triggerEnter(input);
  try {
    await confirmProviderSubmission(operationId, {
      current: () => activeOperationId === operationId && generation === monitorAbort,
      submitted: () => submissionConfirmed(marker),
      retry: () => {
        let freshInput: HTMLTextAreaElement;
        try { freshInput = findInput(); } catch { return; }
        if (normalized(freshInput.value) !== normalized(marker.sentText)) return;
        if (location.href === marker.beforeUrl) {
          if (!triggerSubmitControl()) triggerEnter(freshInput);
        }
      }
    });
    marker.phase = 'monitoring';
    await saveMarker(marker);
  } catch (error) {
    await clearMarker(operationId);
    throw error;
  }
  startMonitor(operationId, generation, marker);
}

async function resumeMonitor(operationId: string): Promise<void> {
  activeOperationId = operationId;
  monitorAbort += 1;
  const generation = monitorAbort;
  const marker = await loadMarker(operationId);
  if (!marker) {
    emitProviderEvent({ type: 'PROVIDER_ERROR', provider: PROVIDER, operationId, error: '文心缺少本次发送记录，停止恢复以免把旧回答当成新回复' });
    activeOperationId = null;
    return;
  }
  try {
    if (marker.phase === 'sending') {
      await confirmProviderSubmission(operationId, {
        current: () => activeOperationId === operationId && generation === monitorAbort,
        submitted: () => submissionConfirmed(marker),
        retry: () => {
          let freshInput: HTMLTextAreaElement;
          try { freshInput = findInput(); } catch { return; }
          if (normalized(freshInput.value) !== normalized(marker.sentText)) return;
          if (location.href === marker.beforeUrl) {
            if (!triggerSubmitControl()) triggerEnter(freshInput);
          }
        }
      });
      marker.phase = 'monitoring';
      await saveMarker(marker);
    }
  } catch (error) {
    if (generation === monitorAbort) {
      emitProviderEvent({ type: 'PROVIDER_ERROR', provider: PROVIDER, operationId, error: error instanceof Error ? error.message : String(error) });
      await clearMarker(operationId);
    }
    return;
  }
  startMonitor(operationId, generation, marker);
}

function findCancelButton(): HTMLElement | null {
  const candidates = [...document.querySelectorAll('button,[role="button"],.ci-submit-button')].filter(visible) as HTMLElement[];
  return candidates.find((item) => /停止|中断|stop|cancel/i.test(`${item.textContent ?? ''} ${item.getAttribute('aria-label') ?? ''} ${item.getAttribute('title') ?? ''} ${item.className}`)) ?? null;
}

async function cancel(operationId?: string): Promise<void> {
  if (operationId && activeOperationId && operationId !== activeOperationId) return;
  monitorAbort += 1;
  findCancelButton()?.click();
  await clearMarker(operationId || activeOperationId || undefined);
  activeOperationId = null;
}

function ready(): boolean {
  try { return Boolean(findInput()); } catch { return false; }
}

installProviderHarness({ provider: PROVIDER, send, cancel, resumeMonitor, ready });
