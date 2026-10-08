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
  function nudgeProviderPage() {
    try {
      document.dispatchEvent(new Event("visibilitychange"));
    } catch {
    }
    try {
      window.dispatchEvent(new Event("focus"));
    } catch {
    }
    checkDomNow();
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
  async function confirmProviderSubmission(operationId, options) {
    let woke = false;
    try {
      nudgeProviderPage();
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const deadline = Date.now() + (options.attemptTimeoutMs ?? 2500);
        while (Date.now() < deadline) {
          if (!options.current()) throw new Error("AI \u64CD\u4F5C\u5DF2\u4E2D\u65AD");
          if (options.submitted()) return;
          await waitForDomMutation(250);
        }
        if (!options.current()) throw new Error("AI \u64CD\u4F5C\u5DF2\u4E2D\u65AD");
        if (options.submitted()) return;
        if (attempt === 2) break;
        nudgeProviderPage();
        if (!woke) {
          await requestProviderWake(operationId);
          woke = true;
        }
        if (!options.current()) throw new Error("AI \u64CD\u4F5C\u5DF2\u4E2D\u65AD");
        if (options.submitted()) return;
        options.retry();
      }
      throw new Error("\u7F51\u9875\u6CA1\u6709\u786E\u8BA4\u672C\u6B21\u6D88\u606F\u5DF2\u53D1\u9001\uFF0C\u505C\u6B62\u63A5\u529B\u4EE5\u514D\u91CD\u590D\u53D1\u9001");
    } finally {
      if (woke) await releaseProviderWake(operationId);
    }
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

  // src/content/wenxin.ts
  var PROVIDER = "wenxin";
  var MONITOR_STORAGE_PREFIX = "multiAiRoundtableWenxin:";
  var INPUT_SELECTORS = [
    "#chat-textarea",
    "textarea.ci-textarea",
    'textarea[placeholder*="\u63D0\u95EE"]',
    'textarea[placeholder*="\u6D88\u606F"]'
  ];
  var activeOperationId = null;
  var monitorAbort = 0;
  function normalized(value) {
    return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  }
  function findInput() {
    for (const selector of INPUT_SELECTORS) {
      const input = [...document.querySelectorAll(selector)].find((item) => item instanceof HTMLTextAreaElement && visible(item));
      if (input instanceof HTMLTextAreaElement) return input;
    }
    throw new Error("\u627E\u4E0D\u5230\u6587\u5FC3\u8F93\u5165\u6846");
  }
  function qaPairs() {
    return [...document.querySelectorAll(".chat-qa-container")].filter(visible);
  }
  function questionText(pair) {
    return pair.querySelector(".cs-rank[data-query]")?.getAttribute("data-query")?.trim() || pair.querySelector(".cs-question-bubble, [data-query]")?.getAttribute("data-query")?.trim() || "";
  }
  function answerElement(pair) {
    const markdown = [...pair.querySelectorAll(".ai-entry-block.ai-markdown, .cosd-markdown-content, .cs-answer-container")].filter(visible).at(-1);
    return markdown instanceof HTMLElement ? markdown : null;
  }
  function readResponse(pair) {
    return elementToMarkdown(answerElement(pair));
  }
  function pairLooksComplete(pair) {
    const statuses = [
      pair.getAttribute("data-chat-status"),
      pair.querySelector(".cs-answer-container")?.getAttribute("data-status"),
      pair.querySelector(".cs-hover-menu[data-status]")?.getAttribute("data-status")
    ].filter(Boolean).map((value) => String(value).toUpperCase());
    return statuses.some((status) => ["COMPLETE", "COMPLETED", "DONE", "SUCCESS"].includes(status));
  }
  function generationActive(pair) {
    if (!pair) return false;
    const statuses = [
      pair.getAttribute("data-chat-status"),
      pair.querySelector(".cs-answer-container")?.getAttribute("data-status")
    ].filter(Boolean).map((value) => String(value).toUpperCase());
    if (statuses.some((status) => ["GENERATING", "STREAMING", "PENDING", "LOADING"].includes(status))) return true;
    const visibleBusyControl = [...pair.querySelectorAll('[class*="loading"], [class*="generating"]')].some(visible);
    return visibleBusyControl && !pairLooksComplete(pair);
  }
  function findPair(marker) {
    const pairs = qaPairs();
    const samePage = location.href === marker.beforeUrl;
    const candidates = pairs.filter((pair, index) => {
      if (samePage && index < marker.baselinePairs) return false;
      return !marker.sentText || normalized(questionText(pair)) === normalized(marker.sentText);
    });
    return candidates.at(-1) ?? null;
  }
  function markerKey(operationId) {
    return `${MONITOR_STORAGE_PREFIX}${operationId}`;
  }
  function parseMarker(value, operationId) {
    if (!value || typeof value !== "object") return null;
    const parsed = value;
    if (parsed.operationId !== operationId || typeof parsed.sentText !== "string" || typeof parsed.beforeUrl !== "string" || typeof parsed.baselinePairs !== "number" || !Number.isInteger(parsed.baselinePairs) || parsed.baselinePairs < 0 || parsed.phase !== "sending" && parsed.phase !== "monitoring") return null;
    return {
      operationId,
      sentText: parsed.sentText,
      beforeUrl: parsed.beforeUrl,
      baselinePairs: parsed.baselinePairs,
      phase: parsed.phase
    };
  }
  async function saveMarker(marker) {
    await chrome.storage.local.set({ [markerKey(marker.operationId)]: marker });
  }
  async function loadMarker(operationId) {
    try {
      const saved = await chrome.storage.local.get(markerKey(operationId));
      return parseMarker(saved[markerKey(operationId)], operationId);
    } catch {
      return null;
    }
  }
  async function clearMarker(operationId) {
    if (!operationId) return;
    await chrome.storage.local.remove(markerKey(operationId)).catch(() => void 0);
  }
  function newPairAfterBaseline(marker) {
    const pairs = qaPairs();
    if (location.href === marker.beforeUrl) return pairs.slice(marker.baselinePairs).at(-1) ?? null;
    return pairs.at(-1) ?? null;
  }
  function submissionConfirmed(marker) {
    if (findPair(marker)) return true;
    let input;
    try {
      input = findInput();
    } catch {
      return false;
    }
    if (normalized(input.value)) return false;
    const pair = newPairAfterBaseline(marker);
    return Boolean(pair && answerElement(pair));
  }
  function triggerEnter(input) {
    input.focus();
    const common = { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true, composed: true };
    input.dispatchEvent(new KeyboardEvent("keydown", common));
    input.dispatchEvent(new KeyboardEvent("keyup", common));
  }
  function triggerSubmitControl() {
    const submit = [...document.querySelectorAll(".ci-submit-button")].find(visible);
    if (!(submit instanceof HTMLElement) || !visible(submit)) return false;
    submit.focus();
    const common = { bubbles: true, cancelable: true, composed: true };
    submit.dispatchEvent(new MouseEvent("mousedown", { ...common, buttons: 1 }));
    submit.dispatchEvent(new MouseEvent("mouseup", { ...common, buttons: 0 }));
    submit.click();
    return true;
  }
  async function monitorResponse(operationId, generation, marker) {
    let started = false;
    let last = "";
    let lastChangeAt = Date.now();
    const startedAt = Date.now();
    while (generation === monitorAbort && Date.now() - startedAt < PROVIDER_MONITOR_MAX_MS) {
      noteMonitorActivity(operationId);
      const pair = findPair(marker);
      const text = pair ? readResponse(pair) : "";
      if (!started) {
        if (!pair || !text) {
          await waitForDomMutation();
          continue;
        }
        started = true;
        last = text;
        lastChangeAt = Date.now();
        emitProviderEvent({ type: "PROVIDER_RESPONSE_STARTED", provider: PROVIDER, operationId });
        emitProviderEvent({ type: "PROVIDER_RESPONSE_DELTA", provider: PROVIDER, operationId, text });
        await waitForDomMutation();
        continue;
      }
      if (text && text !== last) {
        last = text;
        lastChangeAt = Date.now();
        emitProviderEvent({ type: "PROVIDER_RESPONSE_DELTA", provider: PROVIDER, operationId, text });
      } else if (text && text === last) {
        if (responseCompletionReady({
          lastChangeAt,
          explicitComplete: Boolean(pair && pairLooksComplete(pair)),
          generationActive: generationActive(pair)
        })) {
          emitProviderEvent({ type: "PROVIDER_RESPONSE_COMPLETED", provider: PROVIDER, operationId, text: last });
          if (activeOperationId === operationId) activeOperationId = null;
          await clearMarker(operationId);
          return;
        }
      }
      await waitForDomMutation();
    }
    if (generation === monitorAbort) {
      emitProviderEvent({ type: "PROVIDER_ERROR", provider: PROVIDER, operationId, error: "\u6587\u5FC3\u76D1\u542C\u8D85\u65F6\uFF0C\u672A\u786E\u8BA4\u56DE\u590D\u751F\u6210\u7ED3\u675F" });
      await clearMarker(operationId);
    }
  }
  function startMonitor(operationId, generation, marker) {
    void monitorResponse(operationId, generation, marker).catch((error) => {
      if (generation !== monitorAbort) return;
      emitProviderEvent({
        type: "PROVIDER_ERROR",
        provider: PROVIDER,
        operationId,
        error: error instanceof Error ? error.message : String(error)
      });
      void clearMarker(operationId);
    });
  }
  async function send(payload, operationId) {
    if (payload.attachments.length) throw new Error("\u6587\u5FC3\u7F51\u9875\u7AEF\u9644\u4EF6\u5165\u53E3\u7531\u52A8\u6001\u5DE5\u5177\u63A7\u5236\uFF0C\u5F53\u524D\u7248\u672C\u4EC5\u652F\u6301\u6587\u5B57\u8F6C\u53D1");
    activeOperationId = operationId;
    monitorAbort += 1;
    const generation = monitorAbort;
    const input = findInput();
    const marker = {
      operationId,
      sentText: payload.text,
      beforeUrl: location.href,
      baselinePairs: qaPairs().length,
      phase: "sending"
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
          let freshInput;
          try {
            freshInput = findInput();
          } catch {
            return;
          }
          if (normalized(freshInput.value) !== normalized(marker.sentText)) return;
          if (location.href === marker.beforeUrl) {
            if (!triggerSubmitControl()) triggerEnter(freshInput);
          }
        }
      });
      marker.phase = "monitoring";
      await saveMarker(marker);
    } catch (error) {
      await clearMarker(operationId);
      throw error;
    }
    startMonitor(operationId, generation, marker);
  }
  async function resumeMonitor(operationId) {
    activeOperationId = operationId;
    monitorAbort += 1;
    const generation = monitorAbort;
    const marker = await loadMarker(operationId);
    if (!marker) {
      emitProviderEvent({ type: "PROVIDER_ERROR", provider: PROVIDER, operationId, error: "\u6587\u5FC3\u7F3A\u5C11\u672C\u6B21\u53D1\u9001\u8BB0\u5F55\uFF0C\u505C\u6B62\u6062\u590D\u4EE5\u514D\u628A\u65E7\u56DE\u7B54\u5F53\u6210\u65B0\u56DE\u590D" });
      activeOperationId = null;
      return;
    }
    try {
      if (marker.phase === "sending") {
        await confirmProviderSubmission(operationId, {
          current: () => activeOperationId === operationId && generation === monitorAbort,
          submitted: () => submissionConfirmed(marker),
          retry: () => {
            let freshInput;
            try {
              freshInput = findInput();
            } catch {
              return;
            }
            if (normalized(freshInput.value) !== normalized(marker.sentText)) return;
            if (location.href === marker.beforeUrl) {
              if (!triggerSubmitControl()) triggerEnter(freshInput);
            }
          }
        });
        marker.phase = "monitoring";
        await saveMarker(marker);
      }
    } catch (error) {
      if (generation === monitorAbort) {
        emitProviderEvent({ type: "PROVIDER_ERROR", provider: PROVIDER, operationId, error: error instanceof Error ? error.message : String(error) });
        await clearMarker(operationId);
      }
      return;
    }
    startMonitor(operationId, generation, marker);
  }
  function findCancelButton() {
    const candidates = [...document.querySelectorAll('button,[role="button"],.ci-submit-button')].filter(visible);
    return candidates.find((item) => /停止|中断|stop|cancel/i.test(`${item.textContent ?? ""} ${item.getAttribute("aria-label") ?? ""} ${item.getAttribute("title") ?? ""} ${item.className}`)) ?? null;
  }
  async function cancel(operationId) {
    if (operationId && activeOperationId && operationId !== activeOperationId) return;
    monitorAbort += 1;
    findCancelButton()?.click();
    await clearMarker(operationId || activeOperationId || void 0);
    activeOperationId = null;
  }
  function ready() {
    try {
      return Boolean(findInput());
    } catch {
      return false;
    }
  }
  installProviderHarness({ provider: PROVIDER, send, cancel, resumeMonitor, ready });
})();
