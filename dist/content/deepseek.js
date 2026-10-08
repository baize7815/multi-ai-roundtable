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
  async function saveResponseBaseline(operationId, provider, count) {
    await chrome.storage.local.set({ [`${BASELINE_KEY_PREFIX}${operationId}`]: { provider, count, url: location.href } });
  }
  async function confirmResponseBaseline(operationId) {
    const key = `${BASELINE_KEY_PREFIX}${operationId}`;
    const saved = await chrome.storage.local.get(key);
    const baseline = saved[key];
    if (baseline) await chrome.storage.local.set({ [key]: { ...baseline, url: location.href } });
  }
  async function restoreResponseBaseline(operationId, provider, readCount) {
    const saved = await chrome.storage.local.get(`${BASELINE_KEY_PREFIX}${operationId}`);
    const baseline = saved[`${BASELINE_KEY_PREFIX}${operationId}`];
    if (!baseline || baseline.provider !== provider || !Number.isInteger(baseline.count) || baseline.count < 0) {
      throw new Error("\u65E0\u6CD5\u786E\u8BA4\u5F53\u524D\u7F51\u9875\u56DE\u590D\u5C5E\u4E8E\u672C\u6B21\u64CD\u4F5C\uFF0C\u5DF2\u505C\u6B62\u6062\u590D\u76D1\u542C\u4EE5\u514D\u8BEF\u6536\u65E7\u56DE\u7B54\uFF1B\u8BF7\u4E2D\u65AD\u540E\u7EE7\u7EED");
    }
    const deadline = Date.now() + 12e3;
    let stableSince = 0;
    let lastCount = -1;
    while (Date.now() < deadline) {
      noteMonitorActivity(operationId);
      const count = readCount();
      if (baseline.url === location.href && count >= baseline.count) {
        if (!stableSince || count !== lastCount) stableSince = Date.now();
        if (stableSince && Date.now() - stableSince >= 1e3) return baseline.count;
      } else stableSince = 0;
      lastCount = count;
      await sleep(500);
    }
    throw new Error("\u7F51\u9875\u4F1A\u8BDD\u6216\u56DE\u590D\u5217\u8868\u5C1A\u672A\u6062\u590D\uFF0C\u65E0\u6CD5\u786E\u8BA4\u672C\u6B21\u56DE\u7B54\uFF1B\u8BF7\u4E2D\u65AD\u540E\u7EE7\u7EED");
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

  // src/content/deepseek.ts
  var PROVIDER = "deepseek";
  var activeOperationId = null;
  var monitorAbort = 0;
  function findInput() {
    const input = document.querySelector('textarea[placeholder*="DeepSeek"], textarea[name="search"]');
    if (!(input instanceof HTMLTextAreaElement) || !visible(input)) throw new Error("\u627E\u4E0D\u5230 DeepSeek \u8F93\u5165\u6846");
    return input;
  }
  function findSendButton(input) {
    const root = input.parentElement?.parentElement ?? document;
    const candidates = [...root.querySelectorAll('[role="button"].ds-button--primary, [role="button"].ds-button--filled')];
    return candidates.find((element) => visible(element) && !String(element.className).includes("disabled")) ?? null;
  }
  function findCancelButton() {
    const buttons = [...document.querySelectorAll('[role="button"],button')].filter(visible);
    return buttons.find((button) => /停止|stop/i.test([
      button.textContent,
      button.getAttribute("aria-label"),
      button.getAttribute("title"),
      button.getAttribute("data-testid"),
      button.getAttribute("data-test-id")
    ].filter(Boolean).join(" "))) ?? null;
  }
  async function uploadAttachments(payload) {
    if (!payload.attachments.length) return;
    const input = document.querySelector('input[type="file"][multiple]');
    if (!(input instanceof HTMLInputElement)) throw new Error("DeepSeek \u5F53\u524D\u9875\u9762\u627E\u4E0D\u5230\u9644\u4EF6\u4E0A\u4F20\u5165\u53E3");
    setFileInputFiles(input, payload.attachments);
    await sleep(600);
  }
  function latestFinalResponse() {
    const selectors = [".ds-markdown", 'div[class*="markdown"]', '[data-message-role="assistant"]', '[data-testid*="assistant"]'];
    for (const selector of selectors) {
      const matches = [...document.querySelectorAll(selector)].filter(visible);
      const latest = matches.at(-1);
      if (latest) {
        const row = latest.closest("[data-virtual-list-item-key]");
        const final = row?.querySelector(".ds-markdown.ds-assistant-message-main-content") ?? latest;
        return final.closest('.ds-think-content, [data-testid*="thinking"], [data-testid*="reasoning"]') ? null : final;
      }
    }
    return null;
  }
  function readResponse() {
    return elementToMarkdown(latestFinalResponse());
  }
  function responseCount() {
    const selectors = [".ds-markdown", 'div[class*="markdown"]', '[data-message-role="assistant"]', '[data-testid*="assistant"]'];
    for (const selector of selectors) {
      const matches = [...document.querySelectorAll(selector)].filter(visible);
      if (matches.length) return matches.length;
    }
    return 0;
  }
  function responseLooksComplete() {
    const latest = latestFinalResponse();
    const row = latest?.closest("[data-virtual-list-item-key]");
    return Boolean(row?.querySelector('[role="button"][aria-label="Read aloud"], [role="button"][aria-disabled="false"]'));
  }
  async function monitorResponse(operationId, generation, baselineCount) {
    let started = false;
    let last = "";
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
          emitProviderEvent({ type: "PROVIDER_RESPONSE_STARTED", provider: PROVIDER, operationId });
        }
        last = text;
        lastChangeAt = Date.now();
        emitProviderEvent({ type: "PROVIDER_RESPONSE_DELTA", provider: PROVIDER, operationId, text });
      } else if (started && text === last) {
        if (responseCompletionReady({ lastChangeAt, explicitComplete: responseLooksComplete(), generationActive: Boolean(findCancelButton()) })) {
          emitProviderEvent({ type: "PROVIDER_RESPONSE_COMPLETED", provider: PROVIDER, operationId, text: last });
          if (activeOperationId === operationId) activeOperationId = null;
          return;
        }
      }
      await waitForDomMutation();
    }
    if (generation === monitorAbort) emitProviderEvent({ type: "PROVIDER_ERROR", provider: PROVIDER, operationId, error: "DeepSeek \u76D1\u542C\u8D85\u65F6\uFF0C\u672A\u786E\u8BA4\u56DE\u590D\u751F\u6210\u7ED3\u675F" });
  }
  async function send(payload, operationId) {
    activeOperationId = operationId;
    monitorAbort += 1;
    const generation = monitorAbort;
    const input = findInput();
    const baselineCount = responseCount();
    const baselineRows = new Set([...document.querySelectorAll("[data-virtual-list-item-key]")].map((row) => row.getAttribute("data-virtual-list-item-key")));
    await saveResponseBaseline(operationId, PROVIDER, baselineCount);
    await uploadAttachments(payload);
    if (activeOperationId !== operationId || generation !== monitorAbort) throw new Error("AI \u64CD\u4F5C\u5DF2\u4E2D\u65AD");
    input.focus();
    setTextareaText(input, payload.text);
    await sleep(250);
    if (activeOperationId !== operationId || generation !== monitorAbort) throw new Error("AI \u64CD\u4F5C\u5DF2\u4E2D\u65AD");
    const sendButton = findSendButton(input);
    if (!sendButton) throw new Error("DeepSeek \u53D1\u9001\u6309\u94AE\u5C1A\u672A\u8FDB\u5165\u53EF\u53D1\u9001\u72B6\u6001");
    sendButton.click();
    await confirmProviderSubmission(operationId, {
      current: () => activeOperationId === operationId && generation === monitorAbort,
      submitted: () => {
        try {
          const fresh = findInput();
          const submittedRow = [...document.querySelectorAll("[data-virtual-list-item-key]")].some((row) => {
            if (baselineRows.has(row.getAttribute("data-virtual-list-item-key"))) return false;
            const userText = row.querySelector(".ds-collapsible-text");
            const normalize = (value) => value.replace(/\s+/g, " ").trim();
            return userText && normalize(userText.textContent ?? "") === normalize(payload.text);
          });
          return !fresh.value.trim() && (submittedRow || responseCount() > baselineCount || Boolean(findCancelButton()));
        } catch {
          return false;
        }
      },
      retry: () => {
        const fresh = findInput();
        if (fresh.value.trim() === payload.text.trim()) findSendButton(fresh)?.click();
      }
    });
    await confirmResponseBaseline(operationId);
    startMonitor(operationId, generation, baselineCount);
  }
  function startMonitor(operationId, generation, baselineCount) {
    void monitorResponse(operationId, generation, baselineCount).catch((error) => {
      if (generation !== monitorAbort) return;
      emitProviderEvent({
        type: "PROVIDER_ERROR",
        provider: PROVIDER,
        operationId,
        error: error instanceof Error ? error.message : String(error)
      });
    });
  }
  async function resumeMonitor(operationId) {
    activeOperationId = operationId;
    monitorAbort += 1;
    const generation = monitorAbort;
    startMonitor(operationId, generation, await restoreResponseBaseline(operationId, PROVIDER, responseCount));
  }
  async function cancel(operationId) {
    if (operationId && activeOperationId && operationId !== activeOperationId) return;
    monitorAbort += 1;
    findCancelButton()?.click();
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
