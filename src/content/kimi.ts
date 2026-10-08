import { noteMonitorActivity, confirmProviderSubmission, elementToMarkdown, emitProviderEvent, installProviderHarness, PROVIDER_MONITOR_MAX_MS, responseCompletionReady, setContentEditableText, setFileInputFiles, sleep, visible, waitForDomMutation } from './common';
import type { ComposerPayload } from '../shared/types';

const PROVIDER = 'kimi' as const;
const JOURNAL_PREFIX = 'multiAiRoundtableKimi:';
interface OperationJournal { operationId: string; baselineCount: number; sentText: string; phase: 'sending' | 'monitoring' }
let activeOperationId: string | null = null;
let monitorAbort = 0;

function findInput(): HTMLElement {
  const input = document.querySelector('div.chat-input-editor[contenteditable="true"], div.chat-input-editor[role="textbox"], div[role="textbox"][contenteditable="true"]');
  if (!(input instanceof HTMLElement) || !visible(input)) throw new Error('找不到 Kimi 输入框');
  return input;
}

async function uploadAttachments(payload: ComposerPayload): Promise<void> {
  if (!payload.attachments.length) return;
  const input = [...document.querySelectorAll('input[type="file"][multiple]')].find((item) => item instanceof HTMLInputElement) as HTMLInputElement | undefined;
  if (!input) throw new Error('Kimi 当前页面找不到附件上传入口');
  setFileInputFiles(input, payload.attachments);
  await sleep(650);
}

function findSendButton(): HTMLElement | null {
  const button = document.querySelector('.send-button-container:not(.disabled)');
  return button instanceof HTMLElement && visible(button) ? button : null;
}

function findCancelButton(): HTMLElement | null {
  const candidates = [...document.querySelectorAll('button,[role="button"],div[class*="stop"],div[class*="send-button"]')].filter(visible) as HTMLElement[];
  return candidates.find((item) => /停止|中断|stop/i.test(`${item.textContent ?? ''} ${item.getAttribute('aria-label') ?? ''} ${item.className}`)) ?? null;
}

function latestAssistant(): HTMLElement | null {
  const items = [...document.querySelectorAll('.chat-content-item-assistant')].filter(visible);
  return items.at(-1) as HTMLElement | undefined ?? null;
}

function readResponse(): string {
  const item = latestAssistant();
  if (!item) return '';
  const markdownNodes = [...item.querySelectorAll('.markdown-container:not(.toolcall-content-text) .markdown')].filter(visible);
  if (markdownNodes.length) return markdownNodes.map(elementToMarkdown).filter(Boolean).join('\n\n');
  return elementToMarkdown(item);
}

function responseCount(): number {
  return [...document.querySelectorAll('.chat-content-item-assistant')].filter(visible).length;
}

function responseLooksComplete(): boolean {
  return Boolean(latestAssistant()?.querySelector('.segment-assistant-actions'));
}

async function monitorResponse(operationId: string, generation: number, baselineCount: number): Promise<void> {
  let started = false;
  let last = '';
  let lastChangeAt = Date.now();
  const startedAt = Date.now();
  while (generation === monitorAbort && Date.now() - startedAt < PROVIDER_MONITOR_MAX_MS) {
    noteMonitorActivity(operationId);
    const count = responseCount();
    if (!started && count <= baselineCount) { await waitForDomMutation(); continue; }
    const text = readResponse();
    if (text && text !== last) {
      if (!started) {
        started = true;
        emitProviderEvent({ type: 'PROVIDER_RESPONSE_STARTED', provider: PROVIDER, operationId });
      }
      last = text;
      lastChangeAt = Date.now();
      emitProviderEvent({ type: 'PROVIDER_RESPONSE_DELTA', provider: PROVIDER, operationId, text });
    } else if (started && text === last) {
      if (responseCompletionReady({ lastChangeAt, explicitComplete: responseLooksComplete(), generationActive: Boolean(findCancelButton()), visibleFallbackMs: 12000, hiddenFallbackMs: 20000 })) {
        emitProviderEvent({ type: 'PROVIDER_RESPONSE_COMPLETED', provider: PROVIDER, operationId, text: last });
        if (activeOperationId === operationId) activeOperationId = null;
        await chrome.storage.local.remove(`${JOURNAL_PREFIX}${operationId}`);
        return;
      }
    }
    await waitForDomMutation();
  }
  if (generation === monitorAbort) emitProviderEvent({ type: 'PROVIDER_ERROR', provider: PROVIDER, operationId, error: 'Kimi 监听超时，未确认回复生成结束' });
}

function startMonitor(operationId: string, generation: number, baselineCount: number): void {
  void monitorResponse(operationId, generation, baselineCount).catch((error: unknown) => {
    if (generation === monitorAbort && activeOperationId === operationId) emitProviderEvent({ type: 'PROVIDER_ERROR', provider: PROVIDER, operationId, error: error instanceof Error ? error.message : String(error) });
  });
}

function inputMatchesPayload(input: HTMLElement, text: string): boolean {
  const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
  return normalize(input.innerText || input.textContent || '') === normalize(text);
}

async function send(payload: ComposerPayload, operationId: string): Promise<void> {
  activeOperationId = operationId;
  monitorAbort += 1;
  const generation = monitorAbort;
  const input = findInput();
  const baselineCount = responseCount();
  const journal: OperationJournal = { operationId, baselineCount, sentText: payload.text, phase: 'sending' };
  await chrome.storage.local.set({ [`${JOURNAL_PREFIX}${operationId}`]: journal });
  await uploadAttachments(payload);
  if (activeOperationId !== operationId || generation !== monitorAbort) throw new Error('AI 操作已中断');
  setContentEditableText(input, payload.text);
  await sleep(300);
  if (activeOperationId !== operationId || generation !== monitorAbort) throw new Error('AI 操作已中断');
  const button = findSendButton();
  if (button) button.click();
  else input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
  await confirmProviderSubmission(operationId, {
    current: () => activeOperationId === operationId && generation === monitorAbort,
    submitted: () => { try { const fresh = findInput(); return !(fresh.innerText || fresh.textContent || '').trim() && (responseCount() > baselineCount || Boolean(findCancelButton())); } catch { return false; } },
    retry: () => { const fresh = findInput(); if (!inputMatchesPayload(fresh, payload.text)) return; const button = findSendButton(); if (button) button.click(); else fresh.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true })); }
  });
  journal.phase = 'monitoring';
  await chrome.storage.local.set({ [`${JOURNAL_PREFIX}${operationId}`]: journal });
  startMonitor(operationId, generation, baselineCount);
}

async function resumeMonitor(operationId: string): Promise<void> {
  activeOperationId = operationId;
  monitorAbort += 1;
  const generation = monitorAbort;
  const saved = await chrome.storage.local.get(`${JOURNAL_PREFIX}${operationId}`);
  const journal = saved[`${JOURNAL_PREFIX}${operationId}`] as OperationJournal | undefined;
  if (!journal) throw new Error('Kimi 缺少本次发送记录，停止恢复以免读取旧回复');
  if (journal.phase === 'sending') {
    await confirmProviderSubmission(operationId, {
      current: () => activeOperationId === operationId && generation === monitorAbort,
      submitted: () => { try { const input = findInput(); return !(input.innerText || input.textContent || '').trim() && (responseCount() > journal.baselineCount || Boolean(findCancelButton())); } catch { return false; } },
      retry: () => { const input = findInput(); if (inputMatchesPayload(input, journal.sentText)) findSendButton()?.click(); }
    });
    journal.phase = 'monitoring';
    await chrome.storage.local.set({ [`${JOURNAL_PREFIX}${operationId}`]: journal });
  }
  startMonitor(operationId, generation, journal.baselineCount);
}

async function cancel(operationId?: string): Promise<void> {
  if (operationId && activeOperationId && operationId !== activeOperationId) return;
  monitorAbort += 1;
  findCancelButton()?.click();
  await chrome.storage.local.remove(`${JOURNAL_PREFIX}${operationId || activeOperationId}`);
  activeOperationId = null;
}

function ready(): boolean {
  try { return Boolean(findInput()); } catch { return false; }
}

installProviderHarness({ provider: PROVIDER, send, cancel, resumeMonitor, ready });
