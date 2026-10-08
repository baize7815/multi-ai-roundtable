import { saveResponseBaseline, confirmResponseBaseline, restoreResponseBaseline, noteMonitorActivity, composerTextMatches, confirmProviderSubmission, elementToMarkdown, emitProviderEvent, installProviderHarness, PROVIDER_MONITOR_MAX_MS, responseCompletionReady, sleep, visible, waitForDomMutation } from './common';
import type { ComposerPayload } from '../shared/types';

const PROVIDER = 'qwen' as const;
let activeOperationId: string | null = null;
let monitorAbort = 0;

function findInput(): HTMLElement {
  const input = document.querySelector('[contenteditable="true"][data-slate-editor="true"], [contenteditable="true"][data-placeholder="向千问提问"]');
  if (!(input instanceof HTMLElement) || !visible(input)) throw new Error('找不到千问输入框');
  return input;
}

function setSlateText(input: HTMLElement, text: string): void {
  input.focus();
  document.execCommand('selectAll');
  document.execCommand('delete');
  const transfer = new DataTransfer();
  transfer.setData('text/plain', text);
  input.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: transfer }));
}

function findSendButton(): HTMLButtonElement | null {
  const button = document.querySelector('button[aria-label="发送消息"]');
  return button instanceof HTMLButtonElement && visible(button) && !button.disabled ? button : null;
}

function findCancelButton(): HTMLElement | null {
  const candidates = [...document.querySelectorAll('button,[role="button"]')].filter(visible) as HTMLElement[];
  return candidates.find((item) => /停止|中断|stop/i.test(`${item.textContent ?? ''} ${item.getAttribute('aria-label') ?? ''}`)) ?? null;
}

function latestAnswer(): HTMLElement | null {
  const answers = [...document.querySelectorAll('[class*="message-select-wrapper-answer"]')].filter(visible);
  return answers.at(-1) as HTMLElement | undefined ?? null;
}

function readResponse(): string {
  const answer = latestAnswer();
  if (!answer) return '';
  const markdown = [...answer.querySelectorAll('.qk-markdown')].filter(visible).at(-1);
  return elementToMarkdown(markdown ?? answer);
}

function responseCount(): number {
  return [...document.querySelectorAll('[class*="message-select-wrapper-answer"]')].filter(visible).length;
}

function responseLooksComplete(): boolean {
  return Boolean(latestAnswer()?.querySelector('.qk-markdown-complete'));
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
  if (generation === monitorAbort) emitProviderEvent({ type: 'PROVIDER_ERROR', provider: PROVIDER, operationId, error: '千问监听超时，未确认回复生成结束' });
}

async function send(payload: ComposerPayload, operationId: string): Promise<void> {
  if (payload.attachments.length) throw new Error('千问网页端附件入口为动态菜单，当前版本暂不支持自动转发附件；请仅发送文字');
  activeOperationId = operationId;
  monitorAbort += 1;
  const generation = monitorAbort;
  const input = findInput();
  const baselineCount = responseCount();
  await saveResponseBaseline(operationId, PROVIDER, baselineCount);
  setSlateText(input, payload.text);
  await sleep(350);
  if (activeOperationId !== operationId || generation !== monitorAbort) throw new Error('AI 操作已中断');
  const button = findSendButton();
  if (!button) throw new Error('千问发送按钮尚未进入可发送状态');
  button.click();
  await confirmProviderSubmission(operationId, {
    current: () => activeOperationId === operationId && generation === monitorAbort,
    submitted: () => { try { const fresh = findInput(); return !(fresh.innerText || fresh.textContent || '').trim() && (responseCount() > baselineCount || Boolean(findCancelButton())); } catch { return false; } },
    retry: () => { const fresh = findInput(); if (composerTextMatches(fresh.innerText || fresh.textContent || '', payload.text)) findSendButton()?.click(); }
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
