import { noteMonitorActivity, elementToMarkdown, emitProviderEvent, installProviderHarness, PROVIDER_MONITOR_MAX_MS, releaseProviderWake, requestProviderWake, responseCompletionReady, setContentEditableText, setFileInputFiles, setTextareaText, sleep, visible, waitForDomMutation } from './common';
import type { ComposerPayload } from '../shared/types';

const PROVIDER = 'doubao' as const;
const INPUT_SELECTORS = [
  'textarea[placeholder*="发消息"]',
  'textarea[placeholder*="消息"]',
  'textarea.semi-input-textarea',
  'div.tiptap.ProseMirror[contenteditable="true"]',
  'div.ProseMirror[contenteditable="true"]',
  '[role="textbox"][contenteditable="true"]',
  '[contenteditable="true"]'
];
const ASSISTANT_SELECTORS = [
  '[class*="bg-g-receive-msg-bubble"]',
  '[data-testid="receive_message"][data-message-role="assistant"]',
  '[data-testid="receive_message"]'
];
let activeOperationId: string | null = null;
let monitorAbort = 0;
const JOURNAL_PREFIX = 'multiAiRoundtableDoubao:';
interface OperationJournal {
  operationId: string;
  sentText: string;
  baselineText: string;
  baselineCount: number;
  baselineUserCount: number;
  startedAt: number;
  phase: 'sending' | 'monitoring';
  submissionAttempted?: boolean;
  lastText?: string;
  lastChangeAt?: number;
}

async function saveJournal(journal: OperationJournal): Promise<void> {
  await chrome.storage.local.set({ [`${JOURNAL_PREFIX}${journal.operationId}`]: journal });
}

function isCurrent(operationId: string, generation: number): boolean {
  return activeOperationId === operationId && generation === monitorAbort;
}

function findInput(): HTMLElement | null {
  for (const selector of INPUT_SELECTORS) {
    const input = [...document.querySelectorAll(selector)].find((element) => element instanceof HTMLElement && visible(element));
    if (input instanceof HTMLElement) return input;
  }
  return null;
}

async function waitForInput(timeoutMs = 20000): Promise<HTMLElement> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const input = findInput();
    if (input) return input;
    await sleep(250);
  }
  throw new Error('找不到豆包输入框');
}

function setInputText(input: HTMLElement, text: string): void {
  if (input instanceof HTMLTextAreaElement) setTextareaText(input, text);
  else setContentEditableText(input, text);
}

function composerRoot(input: HTMLElement): HTMLElement {
  return input.closest('.guidance-input-surface, form, [class*="chat-input"], [class*="input-area"]') as HTMLElement
    ?? input.parentElement?.parentElement?.parentElement
    ?? input;
}

async function uploadAttachments(input: HTMLElement, payload: ComposerPayload): Promise<void> {
  if (!payload.attachments.length) return;
  const local = composerRoot(input).querySelector('input[type="file"][multiple], input[type="file"]');
  const fallback = document.querySelector('input[type="file"][multiple], input[type="file"]');
  const fileInput = local ?? fallback;
  if (!(fileInput instanceof HTMLInputElement)) throw new Error('豆包当前页面找不到附件上传入口');
  setFileInputFiles(fileInput, payload.attachments);
  await sleep(800);
}

function findSendButton(input: HTMLElement): HTMLElement | null {
  const globalExact = document.querySelector('[data-testid="chat_input_send_button"]');
  if (globalExact instanceof HTMLElement && visible(globalExact) && !globalExact.hasAttribute('disabled') && globalExact.getAttribute('data-disabled') !== 'true') return globalExact;
  const root = composerRoot(input);
  const buttons = [...root.querySelectorAll('button,[role="button"]')].filter(visible) as HTMLElement[];
  const exact = buttons.find((button) => button.getAttribute('data-testid') === 'chat_input_send_button');
  if (exact && !exact.hasAttribute('disabled') && exact.getAttribute('data-disabled') !== 'true') return exact;
  return buttons.find((button) => {
    const descriptor = [
      button.getAttribute('aria-label'),
      button.getAttribute('title'),
      button.getAttribute('data-testid'),
      button.className,
      button.textContent
    ].filter(Boolean).join(' ');
    const enabled = !button.hasAttribute('disabled') && button.getAttribute('data-disabled') !== 'true';
    return enabled && /发送|send|submit/i.test(descriptor) && !/停止|中断|stop|upload|附件/i.test(descriptor);
  }) ?? null;
}

function findCancelButton(): HTMLElement | null {
  const localBreak = document.querySelector('[data-testid="chat_input_local_break_button"]');
  if (localBreak instanceof HTMLElement && visible(localBreak)) return localBreak;
  return ([...document.querySelectorAll('button,[role="button"]')].filter(visible) as HTMLElement[])
    .find((button) => /停止|中断|stop/i.test(`${button.textContent ?? ''} ${button.getAttribute('aria-label') ?? ''} ${button.getAttribute('data-testid') ?? ''}`)) ?? null;
}

function assistantMessages(): HTMLElement[] {
  for (const selector of ASSISTANT_SELECTORS) {
    const matches = [...document.querySelectorAll(selector)].filter(visible) as HTMLElement[];
    if (matches.length) return matches;
  }
  return [];
}

function latestVirtualRow(): HTMLElement | null {
  const rows = [...document.querySelectorAll('.list_items .v_list_row')].filter(visible) as HTMLElement[];
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    if (rows[index].querySelector('[data-message-role="assistant"], [data-testid="receive_message"], [class*="bg-g-receive-msg-bubble"]')) return rows[index];
  }
  return null;
}

function responseElement(): HTMLElement | null {
  return assistantMessages().at(-1) ?? latestVirtualRow();
}

function readResponse(): string {
  const element = responseElement();
  if (!element) return '';
  const clone = element.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('[class*="suggest-message-list-wrapper"], [class*="message-action-bar"]').forEach((item) => item.remove());
  return elementToMarkdown(clone);
}

function responseLooksComplete(): boolean {
  const latest = responseElement();
  const row = latest?.closest('.v_list_row, [data-testid="receive_message"]') ?? latest;
  return Boolean(row?.querySelector('[data-testid="message_action_copy"], [data-testid="message_action_regenerate"], [class*="message-action-bar"]'));
}

function responseStillStreaming(): boolean {
  const latest = responseElement();
  const row = latest?.closest('[data-testid="receive_message"]') ?? latest;
  // Doubao creates the action bar before its markdown renderer has drained.
  // This renderer flag is independent of the composer's stop button.
  return Boolean(row?.matches('[data-streaming="true"]') || row?.querySelector('[data-streaming="true"]'));
}

function normalized(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function inputText(input: HTMLElement): string {
  return input instanceof HTMLTextAreaElement ? input.value : (input.innerText || input.textContent || '');
}

function userMessages(): HTMLElement[] {
  return [...document.querySelectorAll('[data-testid="send_message"], [data-message-role="user"], [class*="bg-g-send-msg-bubble"]')].filter(visible);
}

function submissionConfirmed(journal: OperationJournal): boolean {
  const input = findInput();
  const currentInput = input ? normalized(inputText(input)) : undefined;
  const sent = normalized(journal.sentText);
  const users = userMessages();
  const matchingNewUser = users.length > journal.baselineUserCount && users.slice(journal.baselineUserCount).some((message) => normalized(message.textContent ?? '') === sent);
  if (matchingNewUser) return true;
  // An empty/remounted input alone is not an acknowledgement. Require a new
  // assistant turn or an actual generating control as well.
  return currentInput === '' && (Boolean(findCancelButton()) || assistantMessages().length > journal.baselineCount);
}

async function waitForSendAck(journal: OperationJournal, generation: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isCurrent(journal.operationId, generation)) throw new Error('豆包操作已中断');
    if (submissionConfirmed(journal)) return true;
    await waitForDomMutation(300);
  }
  return false;
}

async function monitorResponse(journal: OperationJournal, generation: number): Promise<void> {
  const { operationId } = journal;
  let started = Boolean(journal.lastText);
  let last = journal.lastText ?? '';
  let lastChangeAt = journal.lastChangeAt ?? Date.now();
  const baseline = normalized(journal.baselineText);
  const sent = normalized(journal.sentText);

  while (isCurrent(operationId, generation) && Date.now() - journal.startedAt < PROVIDER_MONITOR_MAX_MS) {
    noteMonitorActivity(operationId);
    const text = readResponse();
    const current = normalized(text);
    if (!started) {
      const newTurn = assistantMessages().length > journal.baselineCount;
      if (!current || (!newTurn && current === baseline) || (sent && current === sent)) {
        await waitForDomMutation();
        continue;
      }
      started = true;
      last = text;
      lastChangeAt = Date.now();
      emitProviderEvent({ type: 'PROVIDER_RESPONSE_STARTED', provider: PROVIDER, operationId });
      emitProviderEvent({ type: 'PROVIDER_RESPONSE_DELTA', provider: PROVIDER, operationId, text });
    } else if (text && text !== last) {
      last = text;
      lastChangeAt = Date.now();
      emitProviderEvent({ type: 'PROVIDER_RESPONSE_DELTA', provider: PROVIDER, operationId, text });
    } else if (text && text === last) {
      if (!responseStillStreaming() && Date.now() - lastChangeAt >= 3000 && responseCompletionReady({ lastChangeAt, explicitComplete: responseLooksComplete(), generationActive: Boolean(findCancelButton()), visibleFallbackMs: 12000, hiddenFallbackMs: 20000 })) {
        emitProviderEvent({ type: 'PROVIDER_RESPONSE_COMPLETED', provider: PROVIDER, operationId, text: last });
        if (activeOperationId === operationId) activeOperationId = null;
        await chrome.storage.local.remove(`${JOURNAL_PREFIX}${operationId}`);
        return;
      }
    }
    if (last !== journal.lastText) {
      journal.lastText = last;
      journal.lastChangeAt = lastChangeAt;
      await saveJournal(journal);
    }
    await waitForDomMutation(350);
  }

  if (isCurrent(operationId, generation)) emitProviderEvent({ type: 'PROVIDER_ERROR', provider: PROVIDER, operationId, error: '豆包监听超时，未确认回复生成结束' });
}

async function submit(journal: OperationJournal, generation: number): Promise<void> {
  let acknowledged = false;
  let woke = false;
  try {
  for (let attempt = 0; attempt < 4 && !acknowledged; attempt += 1) {
    if (!isCurrent(journal.operationId, generation)) throw new Error('豆包操作已中断');
    if (submissionConfirmed(journal)) { acknowledged = true; break; }
    if (attempt === 1) { await requestProviderWake(journal.operationId); woke = true; }
    if (!isCurrent(journal.operationId, generation)) throw new Error('豆包操作已中断');
    const input = await waitForInput();
    if (normalized(inputText(input)) !== normalized(journal.sentText)) {
      if (inputText(input).trim()) throw new Error('豆包输入框已被修改，停止自动发送以免覆盖内容');
      // Clearing the input may precede rendering the submitted message. Never
      // repopulate it after a click: that could submit the same prompt twice.
      if (journal.submissionAttempted) {
        acknowledged = await waitForSendAck(journal, generation, 3500);
        continue;
      }
      setInputText(input, journal.sentText);
    } else if (attempt > 0) {
      // A homepage may expose its textarea before React attaches listeners.
      // Recreate an input change after waking instead of clicking a permanently
      // disabled button whose DOM value never reached the webpage's state.
      setInputText(input, '');
      setInputText(input, journal.sentText);
    }
    let sendButton: HTMLElement | null = null;
    for (let poll = 0; poll < 14 && !sendButton; poll += 1) {
      await sleep(150);
      sendButton = findSendButton(input);
    }
    if (!isCurrent(journal.operationId, generation)) throw new Error('豆包操作已中断');
    if (normalized(inputText(input)) !== normalized(journal.sentText)) {
      acknowledged = await waitForSendAck(journal, generation, 3500);
      continue;
    }
    journal.submissionAttempted = true;
    await saveJournal(journal);
    if (!isCurrent(journal.operationId, generation)) throw new Error('豆包操作已中断');
    if (sendButton) {
      sendButton.click();
    } else {
      input.focus();
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
      input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
    }
    acknowledged = await waitForSendAck(journal, generation, 2500 + attempt * 750);
    if (!acknowledged) await sleep(350 + attempt * 400);
  }
  if (!acknowledged) throw new Error('豆包文字已写入输入框，但页面没有确认发送；已自动重试，未继续等待假回复');
  } finally { if (woke) await releaseProviderWake(journal.operationId); }
  journal.phase = 'monitoring';
  await saveJournal(journal);
  void monitorResponse(journal, generation).catch((error: unknown) => {
    if (isCurrent(journal.operationId, generation)) emitProviderEvent({ type: 'PROVIDER_ERROR', provider: PROVIDER, operationId: journal.operationId, error: error instanceof Error ? error.message : String(error) });
  });
}

async function send(payload: ComposerPayload, operationId: string): Promise<void> {
  activeOperationId = operationId;
  const generation = ++monitorAbort;
  const input = await waitForInput();
  const journal: OperationJournal = { operationId, sentText: payload.text, baselineText: readResponse(), baselineCount: assistantMessages().length, baselineUserCount: userMessages().length, startedAt: Date.now(), phase: 'sending' };
  await saveJournal(journal);
  await uploadAttachments(input, payload);
  if (!isCurrent(operationId, generation)) throw new Error('豆包操作已中断');
  setInputText(input, payload.text);
  await submit(journal, generation);
}

async function resumeMonitor(operationId: string): Promise<void> {
  activeOperationId = operationId;
  const generation = ++monitorAbort;
  const saved = await chrome.storage.local.get(`${JOURNAL_PREFIX}${operationId}`);
  const journal = saved[`${JOURNAL_PREFIX}${operationId}`] as OperationJournal | undefined;
  if (!journal) throw new Error('豆包缺少本次发送记录，停止恢复以免把旧回答当成新回复');
  if (journal.phase === 'sending') await submit(journal, generation);
  else void monitorResponse(journal, generation).catch((error: unknown) => {
    if (isCurrent(operationId, generation)) emitProviderEvent({ type: 'PROVIDER_ERROR', provider: PROVIDER, operationId, error: error instanceof Error ? error.message : String(error) });
  });
}

async function cancel(operationId?: string): Promise<void> {
  if (operationId && activeOperationId && operationId !== activeOperationId) return;
  monitorAbort += 1;
  findCancelButton()?.click();
  activeOperationId = null;
}

function ready(): boolean {
  return Boolean(findInput());
}

installProviderHarness({ provider: PROVIDER, send, cancel, resumeMonitor, ready });
