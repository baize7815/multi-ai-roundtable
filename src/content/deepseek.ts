import { saveResponseBaseline, confirmResponseBaseline, restoreResponseBaseline, noteMonitorActivity, confirmProviderSubmission, elementToMarkdown, emitProviderEvent, installProviderHarness, PROVIDER_MONITOR_MAX_MS, responseCompletionReady, setFileInputFiles, setTextareaText, sleep, visible, waitForDomMutation } from './common';
import type { ComposerPayload } from '../shared/types';

const PROVIDER = 'deepseek' as const;
let activeOperationId: string | null = null;
let monitorAbort = 0;

function findInput(): HTMLTextAreaElement {
  const input = document.querySelector('textarea[placeholder*="DeepSeek"], textarea[name="search"]');
  if (!(input instanceof HTMLTextAreaElement) || !visible(input)) throw new Error('找不到 DeepSeek 输入框');
  return input;
}

function findSendButton(input: HTMLTextAreaElement): HTMLElement | null {
  const root = input.parentElement?.parentElement ?? document;
  const candidates = [...root.querySelectorAll('[role="button"].ds-button--primary, [role="button"].ds-button--filled')];
  return candidates.find((element) => visible(element) && !String(element.className).includes('disabled')) as HTMLElement | undefined ?? null;
}

function findCancelButton(): HTMLElement | null {
  const buttons = [...document.querySelectorAll('[role="button"],button')].filter(visible) as HTMLElement[];
  return buttons.find((button) => /停止|stop/i.test([
    button.textContent,
    button.getAttribute('aria-label'),
    button.getAttribute('title'),
    button.getAttribute('data-testid'),
    button.getAttribute('data-test-id')
  ].filter(Boolean).join(' '))) ?? null;
}

async function uploadAttachments(payload: ComposerPayload): Promise<void> {
  if (!payload.attachments.length) return;
  const input = document.querySelector('input[type="file"][multiple]');
  if (!(input instanceof HTMLInputElement)) throw new Error('DeepSeek 当前页面找不到附件上传入口');
  setFileInputFiles(input, payload.attachments);
  await sleep(600);
}

function latestFinalResponse(): Element | null {
  const selectors = ['.ds-markdown', 'div[class*="markdown"]', '[data-message-role="assistant"]', '[data-testid*="assistant"]'];
  for (const selector of selectors) {
    const matches = [...document.querySelectorAll(selector)].filter(visible);
    const latest = matches.at(-1);
    if (latest) {
      // Scope final extraction to the newest message, never the last final
      // block from a previous turn while the new turn is still thinking.
      const row = latest.closest('[data-virtual-list-item-key]');
      const final = row?.querySelector('.ds-markdown.ds-assistant-message-main-content') ?? latest;
      return final.closest('.ds-think-content, [data-testid*="thinking"], [data-testid*="reasoning"]') ? null : final;
    }
  }
  return null;
}

function readResponse(): string {
  return elementToMarkdown(latestFinalResponse());
}

function responseCount(): number {
  const selectors = ['.ds-markdown', 'div[class*="markdown"]', '[data-message-role="assistant"]', '[data-testid*="assistant"]'];
  for (const selector of selectors) {
    const matches = [...document.querySelectorAll(selector)].filter(visible);
    if (matches.length) return matches.length;
  }
  return 0;
}

function responseLooksComplete(): boolean {
  const latest = latestFinalResponse();
  const row = latest?.closest('[data-virtual-list-item-key]');
  return Boolean(row?.querySelector('[role="button"][aria-label="Read aloud"], [role="button"][aria-disabled="false"]'));
}

async function monitorResponse(operationId: string, generation: number, baselineCount: number): Promise<void> {
  let started = false;
  let last = '';
  let lastChangeAt = Date.now();
  const startedAt = Date.now();
  while (generation === monitorAbort && Date.now() - startedAt < PROVIDER_MONITOR_MAX_MS) {
    noteMonitorActivity(operationId);
    const count = responseCount();
    if (!started && count <= baselineCount) {
      await waitForDomMutation();
      continue;
    }
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
      if (responseCompletionReady({ lastChangeAt, explicitComplete: responseLooksComplete(), generationActive: Boolean(findCancelButton()) })) {
        emitProviderEvent({ type: 'PROVIDER_RESPONSE_COMPLETED', provider: PROVIDER, operationId, text: last });
        if (activeOperationId === operationId) activeOperationId = null;
        return;
      }
    }
    await waitForDomMutation();
  }
  if (generation === monitorAbort) emitProviderEvent({ type: 'PROVIDER_ERROR', provider: PROVIDER, operationId, error: 'DeepSeek 监听超时，未确认回复生成结束' });
}

async function send(payload: ComposerPayload, operationId: string): Promise<void> {
  activeOperationId = operationId;
  monitorAbort += 1;
  const generation = monitorAbort;
  const input = findInput();
  const baselineCount = responseCount();
  const baselineRows = new Set([...document.querySelectorAll('[data-virtual-list-item-key]')].map((row) => row.getAttribute('data-virtual-list-item-key')));
  await saveResponseBaseline(operationId, PROVIDER, baselineCount);
  await uploadAttachments(payload);
  if (activeOperationId !== operationId || generation !== monitorAbort) throw new Error('AI 操作已中断');
  input.focus();
  setTextareaText(input, payload.text);
  await sleep(250);
  if (activeOperationId !== operationId || generation !== monitorAbort) throw new Error('AI 操作已中断');
  const sendButton = findSendButton(input);
  if (!sendButton) throw new Error('DeepSeek 发送按钮尚未进入可发送状态');
  sendButton.click();
  await confirmProviderSubmission(operationId, {
    current: () => activeOperationId === operationId && generation === monitorAbort,
    submitted: () => {
      try {
        const fresh = findInput();
        const submittedRow = [...document.querySelectorAll('[data-virtual-list-item-key]')].some((row) => {
          if (baselineRows.has(row.getAttribute('data-virtual-list-item-key'))) return false;
          const userText = row.querySelector('.ds-collapsible-text');
          const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
          return userText && normalize(userText.textContent ?? '') === normalize(payload.text);
        });
        return !fresh.value.trim() && (submittedRow || responseCount() > baselineCount || Boolean(findCancelButton()));
      } catch { return false; }
    },
    retry: () => { const fresh = findInput(); if (fresh.value.trim() === payload.text.trim()) findSendButton(fresh)?.click(); }
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

async function resumeMonitor(operationId: string): Promise<void> {
  activeOperationId = operationId;
  monitorAbort += 1;
  const generation = monitorAbort;
  startMonitor(operationId, generation, await restoreResponseBaseline(operationId, PROVIDER, responseCount));
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
