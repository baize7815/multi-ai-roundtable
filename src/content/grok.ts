import { saveResponseBaseline, confirmResponseBaseline, restoreResponseBaseline, noteMonitorActivity, composerTextMatches, confirmProviderSubmission, elementToMarkdown, emitProviderEvent, installProviderHarness, PROVIDER_MONITOR_MAX_MS, responseCompletionReady, setContentEditableText, setFileInputFiles, sleep, visible, waitForDomMutation } from './common';
import type { ComposerPayload } from '../shared/types';

const PROVIDER = 'grok' as const;
let activeOperationId: string | null = null;
let monitorAbort = 0;

function findInput(): HTMLElement {
  const input = [...document.querySelectorAll('[contenteditable="true"][aria-label="Ask Grok anything"], .tiptap.ProseMirror[contenteditable="true"], [role="textbox"][contenteditable="true"]')].find(visible);
  if (!(input instanceof HTMLElement)) throw new Error('找不到 Grok 输入框');
  return input;
}

async function uploadAttachments(payload: ComposerPayload): Promise<void> {
  if (!payload.attachments.length) return;
  const input = [...document.querySelectorAll('input[type="file"][multiple]')].find((item): item is HTMLInputElement => item instanceof HTMLInputElement);
  if (!input) throw new Error('Grok 当前页面找不到附件上传入口');
  setFileInputFiles(input, payload.attachments);
  await sleep(700);
}

function assistantElements(): HTMLElement[] {
  const selectors = [
    '[data-testid="assistant-message"]',
    '[data-testid*="assistant"]',
    'article[data-role="assistant"]',
    '[class*="message"] [class*="markdown"]'
  ];
  for (const selector of selectors) {
    const items = [...document.querySelectorAll(selector)].filter(visible) as HTMLElement[];
    if (items.length) return items;
  }
  return [];
}

function latestAssistant(): HTMLElement | null {
  return assistantElements().at(-1) ?? null;
}

function readResponse(): string {
  const item = latestAssistant();
  if (!item) return '';
  const markdown = [...item.querySelectorAll('.markdown, [class*="markdown"], .prose')].filter(visible).at(-1);
  return elementToMarkdown(markdown ?? item);
}

function generationActive(): boolean {
  return [...document.querySelectorAll('button')].filter(visible).some((button) => /stop|停止/i.test(`${button.getAttribute('aria-label') ?? ''} ${button.textContent ?? ''}`));
}

function findCancelButton(): HTMLElement | null {
  return ([...document.querySelectorAll('button')].filter(visible) as HTMLElement[]).find((button) => /stop|停止/i.test(`${button.getAttribute('aria-label') ?? ''} ${button.textContent ?? ''}`)) ?? null;
}

async function monitorResponse(operationId: string, generation: number, baselineCount: number): Promise<void> {
  let started = false;
  let sawGeneration = false;
  let last = '';
  let lastChangeAt = Date.now();
  const startedAt = Date.now();
  while (generation === monitorAbort && Date.now() - startedAt < PROVIDER_MONITOR_MAX_MS) {
    noteMonitorActivity(operationId);
    const generating = generationActive();
    sawGeneration ||= generating;
    const count = assistantElements().length;
    if (!started && count <= baselineCount) { await waitForDomMutation(); continue; }
    const text = readResponse();
    if (text && text !== last) {
      if (!started) {
        await confirmResponseBaseline(operationId);
        if (generation !== monitorAbort) return;
        started = true;
        emitProviderEvent({ type: 'PROVIDER_RESPONSE_STARTED', provider: PROVIDER, operationId });
      }
      last = text;
      lastChangeAt = Date.now();
      emitProviderEvent({ type: 'PROVIDER_RESPONSE_DELTA', provider: PROVIDER, operationId, text });
    } else if (started && text === last) {
      if (responseCompletionReady({ lastChangeAt, generationActive: generating, observedGenerationComplete: sawGeneration && !generating, visibleFallbackMs: 12000, hiddenFallbackMs: 20000 })) {
        emitProviderEvent({ type: 'PROVIDER_RESPONSE_COMPLETED', provider: PROVIDER, operationId, text: last });
        if (activeOperationId === operationId) activeOperationId = null;
        return;
      }
    }
    await waitForDomMutation();
  }
  if (generation === monitorAbort) emitProviderEvent({ type: 'PROVIDER_ERROR', provider: PROVIDER, operationId, error: 'Grok 监听超时，未确认回复生成结束' });
}

async function resumeMonitor(operationId: string): Promise<void> {
  activeOperationId = operationId;
  monitorAbort += 1;
  const generation = monitorAbort;
  const baselineCount = await restoreResponseBaseline(operationId, PROVIDER, () => assistantElements().length);
  startMonitor(operationId, generation, baselineCount);
}

async function send(payload: ComposerPayload, operationId: string): Promise<void> {
  activeOperationId = operationId;
  monitorAbort += 1;
  const generation = monitorAbort;
  const baselineCount = assistantElements().length;
  await saveResponseBaseline(operationId, PROVIDER, baselineCount);
  const input = findInput();
  await uploadAttachments(payload);
  if (activeOperationId !== operationId || generation !== monitorAbort) throw new Error('AI 操作已中断');
  if (payload.text) setContentEditableText(input, payload.text);
  await sleep(350);
  if (activeOperationId !== operationId || generation !== monitorAbort) throw new Error('AI 操作已中断');
  const sendButton = [...document.querySelectorAll('button')].filter(visible).find((button) => /send|submit|发送/i.test(`${button.getAttribute('aria-label') ?? ''} ${button.textContent ?? ''}`)) as HTMLElement | undefined;
  if (sendButton) sendButton.click();
  else input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
  await confirmProviderSubmission(operationId, {
    current: () => activeOperationId === operationId && generation === monitorAbort,
    submitted: () => { try { const fresh = findInput(); return !(fresh.innerText || fresh.textContent || '').trim() && (assistantElements().length > baselineCount || generationActive()); } catch { return false; } },
    retry: () => { const fresh = findInput(); if (composerTextMatches(fresh.innerText || fresh.textContent || '', payload.text)) fresh.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true })); }
  });
  await confirmResponseBaseline(operationId);
  startMonitor(operationId, generation, baselineCount);
}

function startMonitor(operationId: string, generation: number, baselineCount: number): void {
  void monitorResponse(operationId, generation, baselineCount).catch((error: unknown) => {
    if (generation !== monitorAbort) return;
    emitProviderEvent({
      type: 'PROVIDER_ERROR',
      provider: PROVIDER,
      operationId,
      error: error instanceof Error ? error.message : String(error)
    });
  });
}

async function cancel(operationId?: string): Promise<void> {
  if (operationId && activeOperationId && operationId !== activeOperationId) return;
  monitorAbort += 1;
  findCancelButton()?.click();
  activeOperationId = null;
}

function ready(): boolean {
  try { return Boolean(findInput()); } catch { return false; }
}

installProviderHarness({ provider: PROVIDER, send, cancel, resumeMonitor, ready });
