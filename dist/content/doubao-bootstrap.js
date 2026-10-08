"use strict";
(() => {
  // src/content/doubao-bootstrap.ts
  void chrome.runtime.sendMessage({ type: "PROVIDER_PAGE_BOOTSTRAP", provider: "doubao" }).catch(() => void 0);
})();
