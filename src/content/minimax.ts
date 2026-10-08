import { noteMonitorActivity,
  composerTextMatches,
  confirmProviderSubmission,
  elementToMarkdown,
  emitProviderEvent,
  installProviderHarness,
  PROVIDER_MONITOR_MAX_MS,
  responseCompletionReady,
  setContentEditableText,
  sleep,
  visible,
  waitForDomMutation
} from './common';
import type { ComposerPayload } from '../shared/types';

const PROVIDER = 'minimax' as const;
const JOURNAL_STORAGE_PREFIX = 'multiAiRoundtableMinimax:';
const INPUT_SELECTORS = [
  '[data-testid="message-textarea"][contenteditable="true"]',
  '[data-testid="message-textarea"]',
  '[contenteditable="true"][aria-label*="输入消息"]',
  '[contenteditable="true"][role="textbox"]'
];
const MESSAGE_ROOT_SELECTOR = '[data-message-root-id]';
const USER_BUBBLE_SELECTOR = '[data-testid="user-message-bubble"], .mavis-user-message-bubble';
const ANSWER_SELECTORS = [
  '.mavis-chat-markdown-flow',
  '.desktop-text-markdown-body',
  '.stream-message-content .message-content',
  '.message-content'
];

interface OperationJournal {
  operationId: string;
  sentText: string;
  beforeUrl: string;
  baselineAssistant: number;
  baselineHuman: number;
  baselineHumanIds: string[];
  phase: 'sending' | 'monitoring';
}

let activeOperationId: string | null = null;
let monitorAbort = 0;

function normalized(value: string): string {
  return value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function findInput(): HTMLElement {
  for (const selector of INPUT_SELECTORS) {
    const input = [...document.querySelectorAll(selector)].find((item) => item instanceof HTMLElement && visible(item));
    if (input instanceof HTMLElement) return input;
  }
  throw new Error('找不到 MiniMax 输入框');
}

function editorText(input: HTMLElement): string {
  return normalized(input.innerText || input.textContent || '');
}

function messageRoots(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(MESSAGE_ROOT_SELECTOR)].filter(visible);
}

function isHumanMessage(root: HTMLElement): boolean {
  return Boolean(root.matches(USER_BUBBLE_SELECTOR) || root.querySelector(USER_BUBBLE_SELECTOR));
}

function humanElements(): HTMLElement[] {
  return messageRoots().filter(isHumanMessage);
}

function assistantElements(): HTMLElement[] {
  return messageRoots().filter((root) => !isHumanMessage(root));
}

function humanText(root: HTMLElement): string {
  const bubble = root.matches(USER_BUBBLE_SELECTOR)
    ? root
    : root.querySelector<HTMLElement>(USER_BUBBLE_SELECTOR);
  // User messages display the submitted source literally. Markdown conversion
  // would escape '*'/'[' and fail to match prompts containing formatted replies.
  const text = bubble?.querySelector('[data-testid="user-message-text"]') ?? bubble;
  return normalized(text?.textContent || root.textContent || '');
}

function findMatchingUserIndex(marker: OperationJournal, roots = messageRoots()): number {
  const minimumHumanIndex = marker.baselineHuman;
  const baselineIds = new Set(marker.baselineHumanIds);
  let seenHuman = 0;
  let match = -1;
  roots.forEach((root, index) => {
    if (!isHumanMessage(root)) return;
    const rootId = root.getAttribute('data-message-root-id');
    if (seenHuman >= minimumHumanIndex
      && !baselineIds.has(rootId || '')
      && composerTextMatches(humanText(root), marker.sentText)) match = index;
    seenHuman += 1;
  });
  return match;
}

function assistantElementsFor(marker: OperationJournal): HTMLElement[] {
  const roots = messageRoots();
  const matchingUserIndex = findMatchingUserIndex(marker, roots);
  if (matchingUserIndex >= 0) return roots.slice(matchingUserIndex + 1).filter((root) => !isHumanMessage(root));
  if (location.href !== marker.beforeUrl) return [];
  return assistantElements().slice(marker.baselineAssistant);
}

function latestAssistant(marker: OperationJournal): HTMLElement | null {
  return assistantElementsFor(marker).at(-1) ?? null;
}

function isNonAnswerElement(element: Element): boolean {
  const marker = `${element.className || ''} ${element.getAttribute('data-testid') || ''} ${element.getAttribute('data-role') || ''}`;
  return /thinking|reasoning|activity|tool-call|tool_call|status/i.test(marker);
}

function answerElement(root: HTMLElement): HTMLElement | null {
  // Keep DOM order.  The selector list contains both the provider's narrow
  // markdown node and broader compatibility wrappers; concatenating one
  // selector's results after another can otherwise select an older wrapper
  // instead of the latest formal answer.
  const candidates = [...root.querySelectorAll<HTMLElement>(ANSWER_SELECTORS.join(', '))]
    .filter((element) => !isNonAnswerElement(element) && normalized(element.textContent || ''));
  return candidates.at(-1) ?? null;
}

function readResponse(marker: OperationJournal): string {
  const assistant = latestAssistant(marker);
  if (!assistant) return '';
  const content = answerElement(assistant);
  if (!content) return '';
  const clone = content.cloneNode(true) as HTMLElement;
  clone.querySelectorAll([
    'button',
    'time',
    '[data-testid^="message_action_"]',
    '[data-testid*="thinking" i]',
    '[data-testid*="reasoning" i]',
    '[class*="thinking" i]',
    '[class*="reasoning" i]',
    '[class*="activity" i]',
    '[class*="tool-call" i]',
    '[data-search-skip]'
  ].join(',')).forEach((item) => item.remove());
  return elementToMarkdown(clone);
}

function findSendButton(): HTMLElement | null {
  const candidates = [...document.querySelectorAll<HTMLElement>('[data-testid="send-button"], [aria-label="发送消息"]')];
  return candidates.find((item) => visible(item)
    && item.getAttribute('aria-disabled') !== 'true'
    && item.getAttribute('disabled') === null
    && !/cursor-not-allowed|opacity-0|opacity-40/.test(item.className)) ?? null;
}

function semanticText(element: Element): string {
  return `${element.getAttribute('aria-label') || ''} ${element.getAttribute('title') || ''} ${element.getAttribute('data-testid') || ''} ${element.className || ''}`;
}

function findCancelButton(): HTMLElement | null {
  const candidates = [...document.querySelectorAll<HTMLElement>(
    '[data-testid="send-button"], [aria-label*="停止" i], [aria-label*="中断" i], [aria-label*="stop" i], [aria-label*="cancel" i]'
  )];
  return candidates.find((item) => {
    const text = semanticText(item);
    return item.getAttribute('aria-busy') === 'true' || /停止|中断|stop|cancel|generating|streaming/i.test(text);
  }) ?? null;
}

function hasCopyEvidence(root: HTMLElement): boolean {
  return [...root.querySelectorAll<HTMLElement>(
    '[data-testid*="copy" i], [aria-label*="复制" i], [aria-label*="copy" i]'
  )].some((element) => visible(element));
}

function generationActive(marker: OperationJournal): boolean {
  const latest = latestAssistant(marker);
  if (findCancelButton()) return true;
  if (!latest) return false;
  const finalCopyReady = hasCopyEvidence(latest);
  // MiniMax keeps stale `streaming-content` / stream-tag classes on a
  // completed answer.  The copy affordance is only exposed after the formal
  // answer has settled, so it wins over those stale CSS markers.  A real stop
  // button above still has highest priority and keeps the turn active.
  if (!finalCopyReady && latest.matches('[data-streaming="true"], [data-message-streaming="true"]')) return true;
  if (!finalCopyReady && latest.querySelector('[data-streaming="true"], [data-message-streaming="true"]')) return true;
  // MiniMax keeps `.stream-message-content` on some completed messages.  It
  // is evidence of streaming only until the final answer exposes its copy
  // affordance; otherwise it would prevent completion forever.
  if (!finalCopyReady && latest.querySelector('.stream-message-content')) return true;
  return !finalCopyReady && [...latest.querySelectorAll('[aria-busy="true"], [class*="loading" i], [class*="streaming" i]')]
    .some((element) => !isNonAnswerElement(element));
}

function responseLooksComplete(marker: OperationJournal): boolean {
  const latest = latestAssistant(marker);
  if (!latest || !answerElement(latest)) return false;
  if (generationActive(marker)) return false;
  const status = [
    latest.getAttribute('data-status'),
    latest.getAttribute('data-state'),
    latest.getAttribute('data-message-status'),
    latest.querySelector('[data-status]')?.getAttribute('data-status'),
    latest.querySelector('[data-state]')?.getAttribute('data-state')
  ].filter(Boolean).map((value) => String(value).toUpperCase());
  if (status.some((value) => ['GENERATING', 'STREAMING', 'PENDING', 'LOADING', 'RUNNING'].includes(value))) return false;
  if (status.some((value) => ['COMPLETE', 'COMPLETED', 'DONE', 'SUCCESS', 'FINISHED'].includes(value))) return true;
  return hasCopyEvidence(latest);
}

function markerKey(operationId: string): string {
  return `${JOURNAL_STORAGE_PREFIX}${operationId}`;
}

function parseJournal(value: unknown, operationId: string): OperationJournal | null {
  if (!value || typeof value !== 'object') return null;
  const parsed = value as Partial<OperationJournal>;
  if (parsed.operationId !== operationId
    || typeof parsed.sentText !== 'string'
    || typeof parsed.beforeUrl !== 'string'
    || typeof parsed.baselineAssistant !== 'number'
    || !Number.isInteger(parsed.baselineAssistant)
    || parsed.baselineAssistant < 0
    || typeof parsed.baselineHuman !== 'number'
    || !Number.isInteger(parsed.baselineHuman)
    || parsed.baselineHuman < 0
    || !Array.isArray(parsed.baselineHumanIds)
    || parsed.baselineHumanIds.some((id) => typeof id !== 'string')
    || (parsed.phase !== 'sending' && parsed.phase !== 'monitoring')) return null;
  return {
    operationId,
    sentText: parsed.sentText,
    beforeUrl: parsed.beforeUrl,
    baselineAssistant: parsed.baselineAssistant,
    baselineHuman: parsed.baselineHuman,
    baselineHumanIds: parsed.baselineHumanIds,
    phase: parsed.phase
  };
}

async function saveJournal(journal: OperationJournal): Promise<void> {
  await chrome.storage.local.set({ [markerKey(journal.operationId)]: journal });
}

async function loadJournal(operationId: string): Promise<OperationJournal | null> {
  try {
    const saved = await chrome.storage.local.get(markerKey(operationId));
    return parseJournal(saved[markerKey(operationId)], operationId);
  } catch {
    return null;
  }
}

async function clearJournal(operationId?: string): Promise<void> {
  if (operationId) await chrome.storage.local.remove(markerKey(operationId)).catch(() => undefined);
}

function submissionConfirmed(marker: OperationJournal): boolean {
  const roots = messageRoots();
  const matchingUserIndex = findMatchingUserIndex(marker, roots);
  if (matchingUserIndex >= 0) return true;
  if (location.href !== marker.beforeUrl) return false;
  let input: HTMLElement;
  try { input = findInput(); } catch { return false; }
  return editorText(input) === '' && assistantElements().length > marker.baselineAssistant;
}

function triggerClick(button: HTMLElement): void {
  button.focus();
  const common = { bubbles: true, cancelable: true, composed: true };
  try { button.dispatchEvent(new PointerEvent('pointerdown', { ...common, pointerId: 1, pointerType: 'mouse', isPrimary: true, buttons: 1 })); } catch { /* old Chromium fallback */ }
  button.dispatchEvent(new MouseEvent('mousedown', { ...common, buttons: 1 }));
  try { button.dispatchEvent(new PointerEvent('pointerup', { ...common, pointerId: 1, pointerType: 'mouse', isPrimary: true, buttons: 0 })); } catch { /* old Chromium fallback */ }
  button.dispatchEvent(new MouseEvent('mouseup', { ...common, buttons: 0 }));
  button.click();
}

function triggerEnter(input: HTMLElement): void {
  input.focus();
  const common = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true, composed: true };
  input.dispatchEvent(new KeyboardEvent('keydown', common));
  input.dispatchEvent(new KeyboardEvent('keyup', common));
}

function retrySubmission(marker: OperationJournal): void {
  let input: HTMLElement;
  try { input = findInput(); } catch { return; }
  if (!composerTextMatches(editorText(input), marker.sentText)) return;
  const button = findSendButton();
  if (button) triggerClick(button);
  else triggerEnter(input);
}

async function monitorResponse(operationId: string, generation: number, marker: OperationJournal): Promise<void> {
  let started = false;
  let last = '';
  let lastChangeAt = Date.now();
  const startedAt = Date.now();
  while (generation === monitorAbort && Date.now() - startedAt < PROVIDER_MONITOR_MAX_MS) {
    noteMonitorActivity(operationId);
    const text = readResponse(marker);
    if (!started) {
      if (!text) {
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
    } else if (text && text === last && responseCompletionReady({
      lastChangeAt,
      explicitComplete: responseLooksComplete(marker),
      generationActive: generationActive(marker),
      visibleFallbackMs: 12000,
      hiddenFallbackMs: 20000
    })) {
      emitProviderEvent({ type: 'PROVIDER_RESPONSE_COMPLETED', provider: PROVIDER, operationId, text: last });
      if (activeOperationId === operationId) activeOperationId = null;
      await clearJournal(operationId);
      return;
    }
    await waitForDomMutation();
  }
  if (generation === monitorAbort) {
    emitProviderEvent({ type: 'PROVIDER_ERROR', provider: PROVIDER, operationId, error: 'MiniMax 监听超时，未确认回复生成结束' });
    await clearJournal(operationId);
  }
}

function startMonitor(operationId: string, generation: number, marker: OperationJournal): void {
  void monitorResponse(operationId, generation, marker).catch((error: unknown) => {
    if (generation !== monitorAbort) return;
    emitProviderEvent({
      type: 'PROVIDER_ERROR',
      provider: PROVIDER,
      operationId,
      error: error instanceof Error ? error.message : String(error)
    });
    void clearJournal(operationId);
  });
}

async function send(payload: ComposerPayload, operationId: string): Promise<void> {
  if (payload.attachments.length) throw new Error('MiniMax 网页端附件需要动态上传流程，当前版本仅支持文字转发');
  activeOperationId = operationId;
  monitorAbort += 1;
  const generation = monitorAbort;
  const input = findInput();
  const baselineHumans = humanElements();
  const marker: OperationJournal = {
    operationId,
    sentText: payload.text,
    beforeUrl: location.href,
    baselineAssistant: assistantElements().length,
    baselineHuman: baselineHumans.length,
    baselineHumanIds: baselineHumans
      .map((root) => root.getAttribute('data-message-root-id'))
      .filter((id): id is string => Boolean(id)),
    phase: 'sending'
  };
  await saveJournal(marker);
  setContentEditableText(input, payload.text);
  await sleep(250);
  if (activeOperationId !== operationId || generation !== monitorAbort) throw new Error('AI 操作已中断');
  const button = findSendButton();
  if (button) triggerClick(button);
  else triggerEnter(input);
  try {
    await confirmProviderSubmission(operationId, {
      attemptTimeoutMs: 8000,
      current: () => activeOperationId === operationId && generation === monitorAbort,
      submitted: () => submissionConfirmed(marker),
      retry: () => retrySubmission(marker)
    });
    marker.phase = 'monitoring';
    await saveJournal(marker);
  } catch (error) {
    await clearJournal(operationId);
    throw error;
  }
  startMonitor(operationId, generation, marker);
}

async function resumeMonitor(operationId: string): Promise<void> {
  activeOperationId = operationId;
  monitorAbort += 1;
  const generation = monitorAbort;
  const marker = await loadJournal(operationId);
  if (!marker) {
    emitProviderEvent({ type: 'PROVIDER_ERROR', provider: PROVIDER, operationId, error: 'MiniMax 缺少本次发送记录，停止恢复以免把旧回答当成新回复' });
    activeOperationId = null;
    return;
  }
  try {
    if (marker.phase === 'sending') {
      await confirmProviderSubmission(operationId, {
        attemptTimeoutMs: 8000,
        current: () => activeOperationId === operationId && generation === monitorAbort,
        submitted: () => submissionConfirmed(marker),
        retry: () => retrySubmission(marker)
      });
      marker.phase = 'monitoring';
      await saveJournal(marker);
    }
  } catch (error) {
    if (generation === monitorAbort) {
      emitProviderEvent({ type: 'PROVIDER_ERROR', provider: PROVIDER, operationId, error: error instanceof Error ? error.message : String(error) });
      await clearJournal(operationId);
    }
    return;
  }
  startMonitor(operationId, generation, marker);
}

async function cancel(operationId?: string): Promise<void> {
  if (operationId && activeOperationId && operationId !== activeOperationId) return;
  monitorAbort += 1;
  findCancelButton()?.click();
  await clearJournal(operationId || activeOperationId || undefined);
  activeOperationId = null;
}

function ready(): boolean {
  try { return Boolean(findInput()); } catch { return false; }
}

installProviderHarness({ provider: PROVIDER, send, cancel, resumeMonitor, ready });
