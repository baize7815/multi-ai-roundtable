"use strict";
(() => {
  // src/content/page-liveness.ts
  var key = "__multiAiRoundtableFramesV2";
  var scope = window;
  if (!scope[key]) install();
  function install() {
    scope.__multiAiRoundtableFramesV1?.stop?.();
    const requestNative = window.requestAnimationFrame.bind(window);
    const cancelNative = window.cancelAnimationFrame.bind(window);
    const hiddenGetter = Object.getOwnPropertyDescriptor(Document.prototype, "hidden")?.get;
    const frames = /* @__PURE__ */ new Map();
    let active = false;
    let expiresAt = 0;
    let expiryTimer;
    let descriptors = [];
    const hidden = () => Boolean(hiddenGetter?.call(document));
    const run = (id, timestamp) => {
      const frame = frames.get(id);
      if (!frame) return;
      frames.delete(id);
      if (frame.timer !== void 0) window.clearTimeout(frame.timer);
      cancelNative(id);
      frame.callback(timestamp);
    };
    const schedule = (id) => {
      const frame = frames.get(id);
      if (!active || !frame || frame.timer !== void 0) return;
      frame.timer = window.setTimeout(() => {
        frame.timer = void 0;
        if (!active) return;
        if (Date.now() >= expiresAt) {
          stop();
          return;
        }
        if (hidden()) run(id, performance.now());
      }, 350);
    };
    const stop = () => {
      if (!active) return;
      active = false;
      if (expiryTimer !== void 0) window.clearTimeout(expiryTimer);
      expiryTimer = void 0;
      for (const frame of frames.values()) {
        if (frame.timer !== void 0) window.clearTimeout(frame.timer);
        frame.timer = void 0;
      }
      for (const [name, descriptor] of descriptors) {
        try {
          if (descriptor) Object.defineProperty(document, name, descriptor);
          else delete document[name];
        } catch {
        }
      }
      descriptors = [];
      try {
        document.dispatchEvent(new Event("visibilitychange"));
      } catch {
      }
    };
    const check = () => {
      if (!active || !hidden()) return;
      for (const id of [...frames.keys()]) {
        try {
          run(id, performance.now());
        } catch (error) {
          console.error(error);
        }
      }
    };
    const renew = () => {
      expiresAt = Date.now() + 45e3;
      if (!active) {
        active = true;
        for (const [name, descriptor] of [
          ["hidden", { configurable: true, get: () => false }],
          ["visibilityState", { configurable: true, get: () => "visible" }],
          ["hasFocus", { configurable: true, value: () => true }]
        ]) {
          const original = Object.getOwnPropertyDescriptor(document, name);
          try {
            Object.defineProperty(document, name, descriptor);
            descriptors.push([name, original]);
          } catch {
          }
        }
        try {
          document.dispatchEvent(new Event("visibilitychange"));
        } catch {
        }
        try {
          window.dispatchEvent(new Event("focus"));
        } catch {
        }
      }
      if (expiryTimer !== void 0) window.clearTimeout(expiryTimer);
      expiryTimer = window.setTimeout(stop, 45e3);
      for (const id of frames.keys()) schedule(id);
    };
    window.requestAnimationFrame = (callback) => {
      const id = requestNative((timestamp) => run(id, timestamp));
      frames.set(id, { callback });
      schedule(id);
      return id;
    };
    window.cancelAnimationFrame = (id) => {
      const frame = frames.get(id);
      if (frame?.timer !== void 0) window.clearTimeout(frame.timer);
      frames.delete(id);
      cancelNative(id);
    };
    scope[key] = { renew, check, stop };
    document.addEventListener("__multiAiRoundtableFramesControlV2", (event) => {
      const command = event.detail;
      if (command === "start") {
        renew();
        check();
      } else if (command === "stop") stop();
    });
  }
})();
