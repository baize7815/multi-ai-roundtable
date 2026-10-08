"use strict";
(() => {
  // src/content/minimax-bootstrap.ts
  void chrome.runtime.sendMessage({ type: "PROVIDER_PAGE_BOOTSTRAP", provider: "minimax" }).catch(() => void 0);
})();
