"use strict";
(() => {
  // src/content/provider-bootstrap.ts
  var providers = {
    "chat.deepseek.com": "deepseek",
    "www.kimi.com": "kimi",
    "www.qianwen.com": "qwen",
    "chatglm.cn": "zhipu",
    "chatgpt.com": "gpt",
    "gemini.google.com": "gemini",
    "grok.com": "grok",
    "wenxin.baidu.com": "wenxin"
  };
  var provider = providers[location.hostname];
  if (provider) void chrome.runtime.sendMessage({ type: "PROVIDER_PAGE_BOOTSTRAP", provider }).catch(() => void 0);
})();
