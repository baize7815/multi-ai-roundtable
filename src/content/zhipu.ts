import { saveResponseBaseline, confirmResponseBaseline, restoreResponseBaseline, noteMonitorActivity, composerTextMatches, confirmProviderSubmission, elementToMarkdown, emitProviderEvent, installProviderHarness, PROVIDER_MONITOR_MAX_MS, responseCompletionReady, setFileInputFiles, setTextareaText, sleep, visible, waitForDomMutation } from './common';
import type { ComposerPayload } from '../shared/types';

const PROVIDER = 'zhipu' as const;
let activeOperationId: string | null = null;
let monitorAbort = 0;
let lastComposerIcon = '';
let composerIconIsStop = false;

function findInput(): HTMLTextAreaElement {
  const inputs = [...document.querySelectorAll('textarea.scroll-display-none, textarea')].filter(visible);
  const input = inputs.at(-1);
  if (!(input instanceof HTMLTextAreaElement)) throw new Error('找不到智谱清言输入框');
  return input;
}

async function uploadAttachments(payload: ComposerPayload): Promise<void> {
  if (!payload.attachments.length) return;
  const input = document.querySelector('input.el-upload__input[type="file"][multiple], input[type="file"][multiple]');
  if (!(input instanceof HTMLInputElement)) throw new Error('智谱清言当前页面找不到附件上传入口');
  setFileInputFiles(input, payload.attachments);
  await sleep(650);
}

function findCancelButton(): HTMLElement | null {
  const candidates = [...document.querySelectorAll('button,[role="button"],.enter-icon-container')].filter(visible) as HTMLElement[];
  const labelled = candidates.find((item) => /停止|中断|stop/i.test(`${item.textContent ?? ''} ${item.getAttribute('aria-label') ?? ''} ${item.className}`));
  if (labelled) return labelled;
  // The current composer uses an unlabelled SVG image while generating:
  // a white 12x12 stop square inside its circular button.
  const composer = [...document.querySelectorAll<HTMLElement>('.enter-icon-container')].filter(visible).at(-1);
  const icon = composer?.querySelector<HTMLImageElement>('img.enter_icon');
  const source = icon?.getAttribute('src') ?? '';
  if (source !== lastComposerIcon) {
    lastComposerIcon = source;
    composerIconIsStop = false;
    try {
      const match = /^data:image\/svg\+xml;base64,(.+)$/i.exec(source);
      if (match) {
        const svg = new DOMParser().parseFromString(atob(match[1]), 'image/svg+xml');
        composerIconIsStop = Boolean(svg.querySelector('rect[x="10"][y="10"][width="12"][height="12"]'));
      }
    } catch { /* Unknown icons keep the conservative completion fallback. */ }
  }
  return composer && composerIconIsStop ? composer : null;
}

function latestAnswer(): HTMLElement | null {
  const answers = [...document.querySelectorAll('.answer')].filter(visible);
  return answers.at(-1) as HTMLElement | undefined ?? null;
}

const THINKING_CONTAINER_SELECTOR = [
  '.text-thinking-content',
  '.thinking-content',
  '.reasoning-content',
  '[data-testid*="thinking"]',
  '[data-testid*="reasoning"]'
].join(',');

function isThinkingContent(element: Element): boolean {
  return Boolean(element.closest(THINKING_CONTAINER_SELECTOR));
}

function finalAnswerNodes(answer: HTMLElement): HTMLElement[] {
  const resultNodes = [...answer.querySelectorAll<HTMLElement>('.markdown-body.md-body-result')]
    .filter((node) => visible(node) && !isThinkingContent(node));
  const candidates = resultNodes.length
    ? resultNodes
    : [...answer.querySelectorAll<HTMLElement>('.answer-content-wrap .markdown-body, .markdown-body')]
      .filter((node) => visible(node) && !isThinkingContent(node));

  // ChatGLM can split one final answer across multiple markdown containers.
  // Keep all top-level final nodes, but drop nested duplicates so the answer
  // is neither truncated nor repeated.
  return candidates.filter((node, index) => !candidates.some((other, otherIndex) => otherIndex !== index && other.contains(node)));
}

function readResponse(): string {
  const answer = latestAnswer();
  if (!answer) return '';
  const finals = finalAnswerNodes(answer);
  return finals.map((node) => elementToMarkdown(node)).filter(Boolean).join('\n\n').trim();
}

function responseCount(): number {
  return [...document.querySelectorAll('.answer')].filter(visible).length;
}

function questionElements(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('.conversation.question')].filter(visible);
}

function questionText(question: HTMLElement): string {
  const content = question.querySelector<HTMLElement>('.question-txt') ?? question;
  return content.textContent?.trim() ?? '';
}

async function monitorResponse(operationId: string, generation: number, baselineCount: number): Promise<void> {
  let started = false;
  let last = '';
  let lastChangeAt = Date.now();
  const startedAt = Date.now();
  let sawGeneration = false;
  while (generation === monitorAbort && Date.now() - startedAt < PROVIDER_MONITOR_MAX_MS) {
    noteMonitorActivity(operationId);
    const generationActive = Boolean(findCancelButton());
    sawGeneration ||= generationActive;
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
      if (responseCompletionReady({
        lastChangeAt,
        generationActive,
        observedGenerationComplete: sawGeneration && !generationActive,
        visibleFallbackMs: 8000,
        hiddenFallbackMs: 12000
      })) {
        emitProviderEvent({ type: 'PROVIDER_RESPONSE_COMPLETED', provider: PROVIDER, operationId, text: last });
        if (activeOperationId === operationId) activeOperationId = null;
        return;
      }
    }
    await waitForDomMutation();
  }
  if (generation === monitorAbort) emitProviderEvent({ type: 'PROVIDER_ERROR', provider: PROVIDER, operationId, error: '智谱清言监听超时，未确认回复生成结束' });
}

async function send(payload: ComposerPayload, operationId: string): Promise<void> {
  activeOperationId = operationId;
  monitorAbort += 1;
  const generation = monitorAbort;
  const input = findInput();
  const baselineCount = responseCount();
  const baselineQuestionCount = questionElements().length;
  await saveResponseBaseline(operationId, PROVIDER, baselineCount);
  await uploadAttachments(payload);
  if (activeOperationId !== operationId || generation !== monitorAbort) throw new Error('AI 操作已中断');
  setTextareaText(input, payload.text);
  await sleep(300);
  if (activeOperationId !== operationId || generation !== monitorAbort) throw new Error('AI 操作已中断');
  const sendReady = document.querySelector('.enter-icon-container:not(.empty)');
  if (!(sendReady instanceof HTMLElement) || !visible(sendReady)) throw new Error('智谱清言发送按钮尚未进入可发送状态');
  input.focus();
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
  input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
  await confirmProviderSubmission(operationId, {
    current: () => activeOperationId === operationId && generation === monitorAbort,
    submitted: () => questionElements()
      .slice(baselineQuestionCount)
      .some((question) => composerTextMatches(questionText(question), payload.text)),
    retry: () => {
      const fresh = findInput();
      if (fresh.value.trim() !== payload.text.trim()) return;
      const key = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
      fresh.dispatchEvent(new KeyboardEvent('keydown', key));
      fresh.dispatchEvent(new KeyboardEvent('keyup', key));
    }
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
