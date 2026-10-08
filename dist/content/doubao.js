"use strict";
(() => {
  // src/content/common.ts
  var operationKeepAlive = /* @__PURE__ */ new Map();
  var operationPhases = /* @__PURE__ */ new Map();
  var terminalEvents = /* @__PURE__ */ new Map();
  var terminalDeliveries = /* @__PURE__ */ new Map();
  var pendingDomChecks = /* @__PURE__ */ new Set();
  var TERMINAL_KEY_PREFIX = "multiAiRoundtableTerminal:";
  var BASELINE_KEY_PREFIX = "multiAiRoundtableResponseBaseline:";
  var monitorActivity = /* @__PURE__ */ new Map();
  var monitorResumes = /* @__PURE__ */ new Map();
  var replyAccelerationEnabled = true;
  var pageFramesEnabled = false;
  var lastFrameRenewal = 0;
  function controlPageFrames(command) {
    if (!pageFramesEnabled) return;
    try {
      document.dispatchEvent(new CustomEvent("__multiAiRoundtableFramesControlV2", { detail: command }));
    } catch {
    }
  }
  function noteMonitorActivity(operationId) {
    monitorActivity.set(operationId, Date.now());
    if (Date.now() - lastFrameRenewal >= 1e4) {
      lastFrameRenewal = Date.now();
      controlPageFrames("start");
    }
  }
  function checkDomNow() {
    for (const check of [...pendingDomChecks]) check();
  }
  function beginOperationKeepAlive(operationId) {
    if (!operationId || operationKeepAlive.has(operationId)) return;
    try {
      const port = chrome.runtime.connect({ name: "provider-operation" });
      const ping = () => {
        try {
          port.postMessage({ type: "keepalive", operationId });
        } catch {
        }
      };
      ping();
      const timer = window.setInterval(ping, 15e3);
      const lease = { port, timer };
      operationKeepAlive.set(operationId, lease);
      controlPageFrames("start");
      if (navigator.locks) {
        void navigator.locks.request(`multi-ai-roundtable:${crypto.randomUUID()}`, async () => {
          if (operationKeepAlive.get(operationId) !== lease) return;
          await new Promise((resolve) => {
            lease.releaseLock = resolve;
          });
        }).catch(() => void 0);
      }
      port.onDisconnect.addListener(() => {
        const current = operationKeepAlive.get(operationId);
        if (!current || current.port !== port) return;
        window.clearInterval(current.timer);
        current.releaseLock?.();
        operationKeepAlive.delete(operationId);
        if (!operationKeepAlive.size) controlPageFrames("stop");
      });
    } catch {
    }
  }
  function endOperationKeepAlive(operationId) {
    if (!operationId) return;
    const current = operationKeepAlive.get(operationId);
    if (!current) return;
    window.clearInterval(current.timer);
    current.releaseLock?.();
    try {
      current.port.disconnect();
    } catch {
    }
    operationKeepAlive.delete(operationId);
    if (!operationKeepAlive.size) controlPageFrames("stop");
  }
  function emitProviderEvent(event) {
    if (event.operationId) beginOperationKeepAlive(event.operationId);
    if (event.operationId && (event.type === "PROVIDER_RESPONSE_COMPLETED" || event.type === "PROVIDER_ERROR")) {
      operationPhases.set(event.operationId, event.type === "PROVIDER_ERROR" ? "error" : "completed");
      terminalEvents.set(event.operationId, event);
      void deliverTerminalEvent(event);
      return;
    }
    chrome.runtime.sendMessage({ source: "provider-content", event }).catch(() => void 0);
  }
  async function deliverTerminalEvent(event) {
    const operationId = event.operationId;
    const existing = terminalDeliveries.get(operationId);
    if (existing) return existing;
    const delivery = (async () => {
      const key = `${TERMINAL_KEY_PREFIX}${operationId}`;
      await chrome.storage.local.set({ [key]: event }).catch(() => void 0);
      for (let attempt = 0; attempt < 8; attempt += 1) {
        try {
          const response = await chrome.runtime.sendMessage({ source: "provider-content", event });
          if (response?.success === true) {
            await chrome.storage.local.remove([key, `${BASELINE_KEY_PREFIX}${operationId}`]).catch(() => void 0);
            terminalEvents.delete(operationId);
            monitorActivity.delete(operationId);
            endOperationKeepAlive(operationId);
            return;
          }
        } catch {
        }
        await sleep(Math.min(1e3 * 2 ** attempt, 15e3));
      }
      endOperationKeepAlive(operationId);
    })();
    terminalDeliveries.set(operationId, delivery);
    try {
      await delivery;
    } finally {
      terminalDeliveries.delete(operationId);
    }
  }
  async function requestProviderWake(operationId) {
    const response = await chrome.runtime.sendMessage({ type: "WAKE_PROVIDER_OPERATION", operationId });
    if (response?.success !== true) throw new Error(response?.error || "\u65E0\u6CD5\u5524\u9192\u5F53\u524D AI \u6807\u7B7E\u9875");
    checkDomNow();
  }
  async function releaseProviderWake(operationId) {
    await chrome.runtime.sendMessage({ type: "RELEASE_PROVIDER_WAKE", operationId }).catch(() => void 0);
  }
  function visible(element) {
    if (!(element instanceof HTMLElement)) return false;
    const style = getComputedStyle(element);
    if (!element.isConnected || style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      if (parent.hidden || getComputedStyle(parent).display === "none") return false;
    }
    return true;
  }
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  function waitForDomMutation(timeoutMs = 1e3) {
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
  var PROVIDER_MONITOR_MAX_MS = 30 * 60 * 1e3;
  function responseCompletionReady(options) {
    if (options.generationActive) return false;
    const quietFor = Date.now() - options.lastChangeAt;
    if ((options.explicitComplete || replyAccelerationEnabled && options.observedGenerationComplete) && quietFor >= 1e3) return true;
    const fallbackMs = document.visibilityState === "hidden" ? options.hiddenFallbackMs ?? 2e4 : options.visibleFallbackMs ?? 15e3;
    return quietFor >= fallbackMs;
  }
  function dataUrlToFile(attachment) {
    const [head, body] = attachment.dataUrl.split(",", 2);
    const mime = /data:([^;]+)/.exec(head)?.[1] || attachment.type || "application/octet-stream";
    const binary = atob(body ?? "");
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new File([bytes], attachment.name, { type: mime });
  }
  function setFileInputFiles(input, attachments) {
    if (!attachments.length) return;
    const transfer = new DataTransfer();
    attachments.forEach((attachment) => transfer.items.add(dataUrlToFile(attachment)));
    input.files = transfer.files;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function normalizeText(value) {
    return value.replace(/\u00a0/g, " ").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  }
  function escapeInline(value) {
    return value.replace(/\\/g, "\\\\").replace(/([*_`])/g, "\\$1");
  }
  function nodeToMarkdown(node, listDepth = 0) {
    if (node.nodeType === Node.TEXT_NODE) return escapeInline(node.textContent ?? "");
    if (!(node instanceof HTMLElement)) return "";
    const tag = node.tagName.toLowerCase();
    const children = () => [...node.childNodes].map((child) => nodeToMarkdown(child, listDepth)).join("");
    if (tag === "br") return "\n";
    if (/^h[1-6]$/.test(tag)) return `${"#".repeat(Number(tag[1]))} ${normalizeText(children())}

`;
    if (tag === "p") return `${normalizeText(children())}

`;
    if (tag === "strong" || tag === "b") return `**${normalizeText(children())}**`;
    if (tag === "em" || tag === "i") return `*${normalizeText(children())}*`;
    if (tag === "del" || tag === "s") return `~~${normalizeText(children())}~~`;
    if (tag === "code" && node.parentElement?.tagName.toLowerCase() !== "pre") return `\`${(node.textContent ?? "").replace(/`/g, "\\`")}\``;
    if (tag === "pre") {
      const code = node.textContent ?? "";
      const language = node.querySelector("code")?.className.match(/language-([\w-]+)/)?.[1] ?? "";
      return `

\`\`\`${language}
${code.replace(/\n$/, "")}
\`\`\`

`;
    }
    if (tag === "a") {
      const label = normalizeText(children()) || node.getAttribute("href") || "";
      const href = node.getAttribute("href") || "";
      return href ? `[${label}](${href})` : label;
    }
    if (tag === "img") {
      const src = node.getAttribute("src") || "";
      const alt = escapeInline(node.getAttribute("alt") || "\u56FE\u7247");
      return src ? `![${alt}](${src})` : alt;
    }
    if (tag === "blockquote") {
      return `${normalizeText(children()).split("\n").map((line) => `> ${line}`).join("\n")}

`;
    }
    if (tag === "ul" || tag === "ol") {
      const ordered = tag === "ol";
      const items = [...node.children].filter((child) => child.tagName.toLowerCase() === "li");
      return items.map((item, index) => {
        const body = normalizeText([...item.childNodes].map((child) => nodeToMarkdown(child, listDepth + 1)).join(""));
        const prefix = ordered ? `${index + 1}. ` : "- ";
        const indent = "  ".repeat(listDepth);
        return `${indent}${prefix}${body.replace(/\n/g, `
${indent}  `)}`;
      }).join("\n") + "\n\n";
    }
    if (tag === "table") {
      const rows = [...node.querySelectorAll("tr")].map((row) => [...row.querySelectorAll(":scope > th, :scope > td")].map((cell) => normalizeText(nodeToMarkdown(cell)).replace(/\|/g, "\\|")));
      if (!rows.length) return "";
      const width = Math.max(...rows.map((row) => row.length));
      const header = [...rows[0], ...Array(Math.max(0, width - rows[0].length)).fill("")];
      const body = rows.slice(1).map((row) => [...row, ...Array(Math.max(0, width - row.length)).fill("")]);
      return `| ${header.join(" | ")} |
| ${header.map(() => "---").join(" | ")} |
${body.map((row) => `| ${row.join(" | ")} |`).join("\n")}

`;
    }
    if (tag === "hr") return "\n---\n\n";
    if (tag === "li" || tag === "td" || tag === "th") return children();
    if (["div", "section", "article", "main"].includes(tag)) return children();
    return children();
  }
  function elementToMarkdown(element) {
    if (!(element instanceof HTMLElement)) return "";
    const clone = element.cloneNode(true);
    clone.querySelectorAll('button, time, [data-testid^="message_action_"], [data-testid="audio_play_button"]').forEach((item) => item.remove());
    return normalizeText(nodeToMarkdown(clone));
  }
  function setContentEditableText(input, text) {
    input.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(input);
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.execCommand("delete");
    document.execCommand("insertText", false, text);
    input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function setTextareaText(input, text) {
    input.focus();
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    if (setter) setter.call(input, text);
    else input.value = text;
    input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function installProviderHarness(options) {
    const marker = `__multiAiRoundtableProvider_${options.provider}_v2`;
    const scope = globalThis;
    const installed = scope[marker];
    if (installed?.listener && chrome.runtime.onMessage.hasListener(installed.listener)) return;
    emitProviderEvent({ type: "PROVIDER_READY", provider: options.provider });
    const listener = (message, _sender, sendResponse) => {
      if (typeof message?.replyAcceleration === "boolean") replyAccelerationEnabled = message.replyAcceleration;
      if (typeof message?.pageFramePump === "boolean") {
        if (pageFramesEnabled && !message.pageFramePump) controlPageFrames("stop");
        pageFramesEnabled = message.pageFramePump;
      }
      if (message?.type === "PROVIDER_CONFIG") {
        sendResponse({ success: true });
        return false;
      }
      if (message?.type === "PROVIDER_PING") {
        if (!options.ready) {
          sendResponse({ success: true, provider: options.provider, protocolVersion: 2 });
          return false;
        }
        Promise.resolve(options.ready()).then((ready2) => sendResponse({ success: Boolean(ready2), provider: options.provider, protocolVersion: 2 })).catch(() => sendResponse({ success: false, provider: options.provider }));
        return true;
      }
      if (message?.type === "PROVIDER_SEND") {
        const operationId = String(message.operationId ?? crypto.randomUUID());
        if (operationPhases.has(operationId)) {
          checkDomNow();
          sendResponse({ success: true, phase: operationPhases.get(operationId) });
          return false;
        }
        operationPhases.set(operationId, "sending");
        beginOperationKeepAlive(operationId);
        options.send(message.payload, operationId).then(() => {
          if (operationPhases.get(operationId) === "sending") operationPhases.set(operationId, "monitoring");
          sendResponse({ success: true, phase: operationPhases.get(operationId) });
        }).catch((error) => {
          const text = error instanceof Error ? error.message : String(error);
          emitProviderEvent({ type: "PROVIDER_ERROR", provider: options.provider, operationId, error: text });
          sendResponse({ success: false, error: text });
        });
        return true;
      }
      if (message?.type === "PROVIDER_CANCEL") {
        options.cancel(message.operationId).then(() => {
          endOperationKeepAlive(message.operationId);
          operationPhases.delete(message.operationId);
          sendResponse({ success: true });
        }).catch((error) => sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) }));
        return true;
      }
      if (message?.type === "PROVIDER_CHECK" || message?.type === "PROVIDER_RESUME_MONITOR") {
        const operationId = String(message.operationId ?? "");
        void (async () => {
          checkDomNow();
          const key = `${TERMINAL_KEY_PREFIX}${operationId}`;
          const saved = await chrome.storage.local.get(key);
          const terminal = terminalEvents.get(operationId) ?? saved[key];
          if (terminal) {
            emitProviderEvent(terminal);
            return { success: true, phase: "terminal" };
          }
          const phase = operationPhases.get(operationId);
          if (phase && (phase !== "monitoring" || !replyAccelerationEnabled || Date.now() - (monitorActivity.get(operationId) ?? 0) < 3e4)) return { success: true, phase };
          if (!options.resumeMonitor) return { success: false, error: "\u5F53\u524D\u7F51\u9875\u4E0D\u652F\u6301\u6062\u590D\u76D1\u542C" };
          operationPhases.set(operationId, "monitoring");
          beginOperationKeepAlive(operationId);
          try {
            let resume = monitorResumes.get(operationId);
            if (!resume) {
              noteMonitorActivity(operationId);
              resume = options.resumeMonitor(operationId);
              monitorResumes.set(operationId, resume);
            }
            try {
              await resume;
            } finally {
              if (monitorResumes.get(operationId) === resume) monitorResumes.delete(operationId);
            }
            return { success: true, phase: operationPhases.get(operationId), resumed: true };
          } catch (error) {
            operationPhases.delete(operationId);
            endOperationKeepAlive(operationId);
            emitProviderEvent({ type: "PROVIDER_ERROR", provider: options.provider, operationId, error: error instanceof Error ? error.message : String(error) });
            throw error;
          }
        })().then(sendResponse).catch((error) => sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) }));
        return true;
      }
      return false;
    };
    chrome.runtime.onMessage.addListener(listener);
    scope[marker] = { listener };
  }

  // src/content/doubao.ts
  var PROVIDER = "doubao";
  var INPUT_SELECTORS = [
    'textarea[placeholder*="\u53D1\u6D88\u606F"]',
    'textarea[placeholder*="\u6D88\u606F"]',
    "textarea.semi-input-textarea",
    'div.tiptap.ProseMirror[contenteditable="true"]',
    'div.ProseMirror[contenteditable="true"]',
    '[role="textbox"][contenteditable="true"]',
    '[contenteditable="true"]'
  ];
  var ASSISTANT_SELECTORS = [
    '[class*="bg-g-receive-msg-bubble"]',
    '[data-testid="receive_message"][data-message-role="assistant"]',
    '[data-testid="receive_message"]'
  ];
  var activeOperationId = null;
  var monitorAbort = 0;
  var JOURNAL_PREFIX = "multiAiRoundtableDoubao:";
  async function saveJournal(journal) {
    await chrome.storage.local.set({ [`${JOURNAL_PREFIX}${journal.operationId}`]: journal });
  }
  function isCurrent(operationId, generation) {
    return activeOperationId === operationId && generation === monitorAbort;
  }
  function findInput() {
    for (const selector of INPUT_SELECTORS) {
      const input = [...document.querySelectorAll(selector)].find((element) => element instanceof HTMLElement && visible(element));
      if (input instanceof HTMLElement) return input;
    }
    return null;
  }
  async function waitForInput(timeoutMs = 2e4) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const input = findInput();
      if (input) return input;
      await sleep(250);
    }
    throw new Error("\u627E\u4E0D\u5230\u8C46\u5305\u8F93\u5165\u6846");
  }
  function setInputText(input, text) {
    if (input instanceof HTMLTextAreaElement) setTextareaText(input, text);
    else setContentEditableText(input, text);
  }
  function composerRoot(input) {
    return input.closest('.guidance-input-surface, form, [class*="chat-input"], [class*="input-area"]') ?? input.parentElement?.parentElement?.parentElement ?? input;
  }
  async function uploadAttachments(input, payload) {
    if (!payload.attachments.length) return;
    const local = composerRoot(input).querySelector('input[type="file"][multiple], input[type="file"]');
    const fallback = document.querySelector('input[type="file"][multiple], input[type="file"]');
    const fileInput = local ?? fallback;
    if (!(fileInput instanceof HTMLInputElement)) throw new Error("\u8C46\u5305\u5F53\u524D\u9875\u9762\u627E\u4E0D\u5230\u9644\u4EF6\u4E0A\u4F20\u5165\u53E3");
    setFileInputFiles(fileInput, payload.attachments);
    await sleep(800);
  }
  function findSendButton(input) {
    const globalExact = document.querySelector('[data-testid="chat_input_send_button"]');
    if (globalExact instanceof HTMLElement && visible(globalExact) && !globalExact.hasAttribute("disabled") && globalExact.getAttribute("data-disabled") !== "true") return globalExact;
    const root = composerRoot(input);
    const buttons = [...root.querySelectorAll('button,[role="button"]')].filter(visible);
    const exact = buttons.find((button) => button.getAttribute("data-testid") === "chat_input_send_button");
    if (exact && !exact.hasAttribute("disabled") && exact.getAttribute("data-disabled") !== "true") return exact;
    return buttons.find((button) => {
      const descriptor = [
        button.getAttribute("aria-label"),
        button.getAttribute("title"),
        button.getAttribute("data-testid"),
        button.className,
        button.textContent
      ].filter(Boolean).join(" ");
      const enabled = !button.hasAttribute("disabled") && button.getAttribute("data-disabled") !== "true";
      return enabled && /发送|send|submit/i.test(descriptor) && !/停止|中断|stop|upload|附件/i.test(descriptor);
    }) ?? null;
  }
  function findCancelButton() {
    const localBreak = document.querySelector('[data-testid="chat_input_local_break_button"]');
    if (localBreak instanceof HTMLElement && visible(localBreak)) return localBreak;
    return [...document.querySelectorAll('button,[role="button"]')].filter(visible).find((button) => /停止|中断|stop/i.test(`${button.textContent ?? ""} ${button.getAttribute("aria-label") ?? ""} ${button.getAttribute("data-testid") ?? ""}`)) ?? null;
  }
  function assistantMessages() {
    for (const selector of ASSISTANT_SELECTORS) {
      const matches = [...document.querySelectorAll(selector)].filter(visible);
      if (matches.length) return matches;
    }
    return [];
  }
  function latestVirtualRow() {
    const rows = [...document.querySelectorAll(".list_items .v_list_row")].filter(visible);
    for (let index = rows.length - 1; index >= 0; index -= 1) {
      if (rows[index].querySelector('[data-message-role="assistant"], [data-testid="receive_message"], [class*="bg-g-receive-msg-bubble"]')) return rows[index];
    }
    return null;
  }
  function responseElement() {
    return assistantMessages().at(-1) ?? latestVirtualRow();
  }
  function readResponse() {
    const element = responseElement();
    if (!element) return "";
    const clone = element.cloneNode(true);
    clone.querySelectorAll('[class*="suggest-message-list-wrapper"], [class*="message-action-bar"]').forEach((item) => item.remove());
    return elementToMarkdown(clone);
  }
  function responseLooksComplete() {
    const latest = responseElement();
    const row = latest?.closest('.v_list_row, [data-testid="receive_message"]') ?? latest;
    return Boolean(row?.querySelector('[data-testid="message_action_copy"], [data-testid="message_action_regenerate"], [class*="message-action-bar"]'));
  }
  function responseStillStreaming() {
    const latest = responseElement();
    const row = latest?.closest('[data-testid="receive_message"]') ?? latest;
    return Boolean(row?.matches('[data-streaming="true"]') || row?.querySelector('[data-streaming="true"]'));
  }
  function normalized(value) {
    return value.replace(/\s+/g, " ").trim();
  }
  function inputText(input) {
    return input instanceof HTMLTextAreaElement ? input.value : input.innerText || input.textContent || "";
  }
  function userMessages() {
    return [...document.querySelectorAll('[data-testid="send_message"], [data-message-role="user"], [class*="bg-g-send-msg-bubble"]')].filter(visible);
  }
  function submissionConfirmed(journal) {
    const input = findInput();
    const currentInput = input ? normalized(inputText(input)) : void 0;
    const sent = normalized(journal.sentText);
    const users = userMessages();
    const matchingNewUser = users.length > journal.baselineUserCount && users.slice(journal.baselineUserCount).some((message) => normalized(message.textContent ?? "") === sent);
    if (matchingNewUser) return true;
    return currentInput === "" && (Boolean(findCancelButton()) || assistantMessages().length > journal.baselineCount);
  }
  async function waitForSendAck(journal, generation, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (!isCurrent(journal.operationId, generation)) throw new Error("\u8C46\u5305\u64CD\u4F5C\u5DF2\u4E2D\u65AD");
      if (submissionConfirmed(journal)) return true;
      await waitForDomMutation(300);
    }
    return false;
  }
  async function monitorResponse(journal, generation) {
    const { operationId } = journal;
    let started = Boolean(journal.lastText);
    let last = journal.lastText ?? "";
    let lastChangeAt = journal.lastChangeAt ?? Date.now();
    const baseline = normalized(journal.baselineText);
    const sent = normalized(journal.sentText);
    while (isCurrent(operationId, generation) && Date.now() - journal.startedAt < PROVIDER_MONITOR_MAX_MS) {
      noteMonitorActivity(operationId);
      const text = readResponse();
      const current = normalized(text);
      if (!started) {
        const newTurn = assistantMessages().length > journal.baselineCount;
        if (!current || !newTurn && current === baseline || sent && current === sent) {
          await waitForDomMutation();
          continue;
        }
        started = true;
        last = text;
        lastChangeAt = Date.now();
        emitProviderEvent({ type: "PROVIDER_RESPONSE_STARTED", provider: PROVIDER, operationId });
        emitProviderEvent({ type: "PROVIDER_RESPONSE_DELTA", provider: PROVIDER, operationId, text });
      } else if (text && text !== last) {
        last = text;
        lastChangeAt = Date.now();
        emitProviderEvent({ type: "PROVIDER_RESPONSE_DELTA", provider: PROVIDER, operationId, text });
      } else if (text && text === last) {
        if (!responseStillStreaming() && Date.now() - lastChangeAt >= 3e3 && responseCompletionReady({ lastChangeAt, explicitComplete: responseLooksComplete(), generationActive: Boolean(findCancelButton()), visibleFallbackMs: 12e3, hiddenFallbackMs: 2e4 })) {
          emitProviderEvent({ type: "PROVIDER_RESPONSE_COMPLETED", provider: PROVIDER, operationId, text: last });
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
    if (isCurrent(operationId, generation)) emitProviderEvent({ type: "PROVIDER_ERROR", provider: PROVIDER, operationId, error: "\u8C46\u5305\u76D1\u542C\u8D85\u65F6\uFF0C\u672A\u786E\u8BA4\u56DE\u590D\u751F\u6210\u7ED3\u675F" });
  }
  async function submit(journal, generation) {
    let acknowledged = false;
    let woke = false;
    try {
      for (let attempt = 0; attempt < 4 && !acknowledged; attempt += 1) {
        if (!isCurrent(journal.operationId, generation)) throw new Error("\u8C46\u5305\u64CD\u4F5C\u5DF2\u4E2D\u65AD");
        if (submissionConfirmed(journal)) {
          acknowledged = true;
          break;
        }
        if (attempt === 1) {
          await requestProviderWake(journal.operationId);
          woke = true;
        }
        if (!isCurrent(journal.operationId, generation)) throw new Error("\u8C46\u5305\u64CD\u4F5C\u5DF2\u4E2D\u65AD");
        const input = await waitForInput();
        if (normalized(inputText(input)) !== normalized(journal.sentText)) {
          if (inputText(input).trim()) throw new Error("\u8C46\u5305\u8F93\u5165\u6846\u5DF2\u88AB\u4FEE\u6539\uFF0C\u505C\u6B62\u81EA\u52A8\u53D1\u9001\u4EE5\u514D\u8986\u76D6\u5185\u5BB9");
          if (journal.submissionAttempted) {
            acknowledged = await waitForSendAck(journal, generation, 3500);
            continue;
          }
          setInputText(input, journal.sentText);
        } else if (attempt > 0) {
          setInputText(input, "");
          setInputText(input, journal.sentText);
        }
        let sendButton = null;
        for (let poll = 0; poll < 14 && !sendButton; poll += 1) {
          await sleep(150);
          sendButton = findSendButton(input);
        }
        if (!isCurrent(journal.operationId, generation)) throw new Error("\u8C46\u5305\u64CD\u4F5C\u5DF2\u4E2D\u65AD");
        if (normalized(inputText(input)) !== normalized(journal.sentText)) {
          acknowledged = await waitForSendAck(journal, generation, 3500);
          continue;
        }
        journal.submissionAttempted = true;
        await saveJournal(journal);
        if (!isCurrent(journal.operationId, generation)) throw new Error("\u8C46\u5305\u64CD\u4F5C\u5DF2\u4E2D\u65AD");
        if (sendButton) {
          sendButton.click();
        } else {
          input.focus();
          input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true }));
          input.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true }));
        }
        acknowledged = await waitForSendAck(journal, generation, 2500 + attempt * 750);
        if (!acknowledged) await sleep(350 + attempt * 400);
      }
      if (!acknowledged) throw new Error("\u8C46\u5305\u6587\u5B57\u5DF2\u5199\u5165\u8F93\u5165\u6846\uFF0C\u4F46\u9875\u9762\u6CA1\u6709\u786E\u8BA4\u53D1\u9001\uFF1B\u5DF2\u81EA\u52A8\u91CD\u8BD5\uFF0C\u672A\u7EE7\u7EED\u7B49\u5F85\u5047\u56DE\u590D");
    } finally {
      if (woke) await releaseProviderWake(journal.operationId);
    }
    journal.phase = "monitoring";
    await saveJournal(journal);
    void monitorResponse(journal, generation).catch((error) => {
      if (isCurrent(journal.operationId, generation)) emitProviderEvent({ type: "PROVIDER_ERROR", provider: PROVIDER, operationId: journal.operationId, error: error instanceof Error ? error.message : String(error) });
    });
  }
  async function send(payload, operationId) {
    activeOperationId = operationId;
    const generation = ++monitorAbort;
    const input = await waitForInput();
    const journal = { operationId, sentText: payload.text, baselineText: readResponse(), baselineCount: assistantMessages().length, baselineUserCount: userMessages().length, startedAt: Date.now(), phase: "sending" };
    await saveJournal(journal);
    await uploadAttachments(input, payload);
    if (!isCurrent(operationId, generation)) throw new Error("\u8C46\u5305\u64CD\u4F5C\u5DF2\u4E2D\u65AD");
    setInputText(input, payload.text);
    await submit(journal, generation);
  }
  async function resumeMonitor(operationId) {
    activeOperationId = operationId;
    const generation = ++monitorAbort;
    const saved = await chrome.storage.local.get(`${JOURNAL_PREFIX}${operationId}`);
    const journal = saved[`${JOURNAL_PREFIX}${operationId}`];
    if (!journal) throw new Error("\u8C46\u5305\u7F3A\u5C11\u672C\u6B21\u53D1\u9001\u8BB0\u5F55\uFF0C\u505C\u6B62\u6062\u590D\u4EE5\u514D\u628A\u65E7\u56DE\u7B54\u5F53\u6210\u65B0\u56DE\u590D");
    if (journal.phase === "sending") await submit(journal, generation);
    else void monitorResponse(journal, generation).catch((error) => {
      if (isCurrent(operationId, generation)) emitProviderEvent({ type: "PROVIDER_ERROR", provider: PROVIDER, operationId, error: error instanceof Error ? error.message : String(error) });
    });
  }
  async function cancel(operationId) {
    if (operationId && activeOperationId && operationId !== activeOperationId) return;
    monitorAbort += 1;
    findCancelButton()?.click();
    activeOperationId = null;
  }
  function ready() {
    return Boolean(findInput());
  }
  installProviderHarness({ provider: PROVIDER, send, cancel, resumeMonitor, ready });
})();
