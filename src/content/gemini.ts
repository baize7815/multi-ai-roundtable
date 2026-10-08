import { saveResponseBaseline, confirmResponseBaseline, restoreResponseBaseline, noteMonitorActivity, composerTextMatches, confirmProviderSubmission, elementToMarkdown, emitProviderEvent, installProviderHarness, PROVIDER_MONITOR_MAX_MS, responseCompletionReady, setFileInputFiles, sleep, visible, waitForDomMutation } from './common';
import type { AttachmentPayload, ComposerPayload } from '../shared/types';

const PROVIDER = 'gemini' as const;
let activeOperationId: string | null = null;
let monitorAbort = 0;

function findInput(): HTMLElement {
  const input = [...document.querySelectorAll('.ql-editor[contenteditable="true"], [contenteditable="true"][aria-label*="prompt" i], [role="textbox"][contenteditable="true"]')].find(visible);
  if (!(input instanceof HTMLElement)) throw new Error('找不到 Gemini 输入框');
  return input;
}

function setGeminiText(input: HTMLElement, text: string): void {
  input.focus();
  input.innerHTML = '';
  const paragraph = document.createElement('p');
  paragraph.textContent = text;
  input.append(paragraph);
  input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function findUploadButton(): HTMLElement | null {
  return ([...document.querySelectorAll('button')].filter(visible) as HTMLElement[])
    .find((button) => /Upload & tools/i.test(button.getAttribute('aria-label') ?? '')) ?? null;
}

async function uploadGroup(attachments: AttachmentPayload[], images: boolean): Promise<void> {
  if (!attachments.length) return;
  const button = findUploadButton();
  if (!button) throw new Error('Gemini 当前页面找不到上传菜单');
  button.click();
  await sleep(250);
  const inputs = [...document.querySelectorAll('input[type="file"][multiple]')]
    .filter((item): item is HTMLInputElement => item instanceof HTMLInputElement);
  const input = images
    ? inputs.find((item) => item.accept.includes('image/*'))
    : inputs.find((item) => !item.accept.includes('image/*'));
  if (!input) throw new Error(`Gemini 当前页面找不到${images ? '图片' : '附件'}上传入口`);
  setFileInputFiles(input, attachments);
  await sleep(900);
}

async function uploadAttachments(payload: ComposerPayload): Promise<void> {
  await uploadGroup(payload.attachments.filter((item) => item.kind === 'attachment'), false);
  await uploadGroup(payload.attachments.filter((item) => item.kind === 'image'), true);
}

function responseElements(): HTMLElement[] {
  const selectors = ['model-response .model-response-text', '.model-response-text', 'model-response message-content', 'message-content'];
  for (const selector of selectors) {
    const items = [...document.querySelectorAll(selector)].filter(visible) as HTMLElement[];
    if (items.length) return items;
  }
  return [];
}

function latestResponse(): HTMLElement | null {
  return responseElements().at(-1) ?? null;
}

function readResponse(): string {
  return elementToMarkdown(latestResponse());
}

function generationActive(): boolean {
  return [...document.querySelectorAll('button')].filter(visible).some((button) => /stop response|stop generating|stop|停止/i.test(`${button.getAttribute('aria-label') ?? ''} ${button.textContent ?? ''}`));
}

function findCancelButton(): HTMLElement | null {
  return ([...document.querySelectorAll('button')].filter(visible) as HTMLElement[]).find((button) => /stop response|stop generating|stop|停止/i.test(`${button.getAttribute('aria-label') ?? ''} ${button.textContent ?? ''}`)) ?? null;
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
    const count = responseElements().length;
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
  if (generation === monitorAbort) emitProviderEvent({ type: 'PROVIDER_ERROR', provider: PROVIDER, operationId, error: 'Gemini 监听超时，未确认回复生成结束' });
}

async function resumeMonitor(operationId: string): Promise<void> {
  activeOperationId = operationId;
  monitorAbort += 1;
  const generation = monitorAbort;
  const baselineCount = await restoreResponseBaseline(operationId, PROVIDER, () => responseElements().length);
  startMonitor(operationId, generation, baselineCount);
}

async function send(payload: ComposerPayload, operationId: string): Promise<void> {
  activeOperationId = operationId;
  monitorAbort += 1;
  const generation = monitorAbort;
  const baselineCount = responseElements().length;
  await saveResponseBaseline(operationId, PROVIDER, baselineCount);
  const input = findInput();
  await uploadAttachments(payload);
  if (activeOperationId !== operationId || generation !== monitorAbort) throw new Error('AI 操作已中断');
  setGeminiText(input, payload.text);
  await sleep(350);
  if (activeOperationId !== operationId || generation !== monitorAbort) throw new Error('AI 操作已中断');
  const sendButton = [...document.querySelectorAll('button')].filter(visible).find((button) => /send|发送/i.test(`${button.getAttribute('aria-label') ?? ''} ${button.getAttribute('data-test-id') ?? ''}`)) as HTMLElement | undefined;
  if (sendButton) sendButton.click();
  else input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
  await confirmProviderSubmission(operationId, {
    current: () => activeOperationId === operationId && generation === monitorAbort,
    submitted: () => { try { const fresh = findInput(); return !(fresh.innerText || fresh.textContent || '').trim() && (responseElements().length > baselineCount || generationActive()); } catch { return false; } },
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
