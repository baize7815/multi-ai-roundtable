// Runs in MAIN at document_start, before a site can cache native animation APIs.
// Until the extension starts a lease, callbacks retain their native scheduling.
const key = '__multiAiRoundtableFramesV2';
const scope = window as typeof window & Record<string, unknown>;
if (!scope[key]) install();

function install(): void {
  (scope.__multiAiRoundtableFramesV1 as { stop?: () => void } | undefined)?.stop?.();
  const requestNative = window.requestAnimationFrame.bind(window);
  const cancelNative = window.cancelAnimationFrame.bind(window);
  const hiddenGetter = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden')?.get;
  const frames = new Map<number, { callback: FrameRequestCallback; timer?: number }>();
  let active = false;
  let expiresAt = 0;
  let expiryTimer: number | undefined;
  let descriptors: Array<[string, PropertyDescriptor | undefined]> = [];

  const hidden = () => Boolean(hiddenGetter?.call(document));
  const run = (id: number, timestamp: number) => {
    const frame = frames.get(id);
    if (!frame) return;
    frames.delete(id);
    if (frame.timer !== undefined) window.clearTimeout(frame.timer);
    cancelNative(id);
    frame.callback(timestamp);
  };
  const schedule = (id: number) => {
    const frame = frames.get(id);
    if (!active || !frame || frame.timer !== undefined) return;
    frame.timer = window.setTimeout(() => {
      frame.timer = undefined;
      if (!active) return;
      if (Date.now() >= expiresAt) { stop(); return; }
      if (hidden()) run(id, performance.now());
    }, 350);
  };
  const stop = () => {
    if (!active) return;
    active = false;
    if (expiryTimer !== undefined) window.clearTimeout(expiryTimer);
    expiryTimer = undefined;
    for (const frame of frames.values()) {
      if (frame.timer !== undefined) window.clearTimeout(frame.timer);
      frame.timer = undefined;
    }
    for (const [name, descriptor] of descriptors) {
      try {
        if (descriptor) Object.defineProperty(document, name, descriptor);
        else delete (document as unknown as Record<string, unknown>)[name];
      } catch { /* best effort */ }
    }
    descriptors = [];
    try { document.dispatchEvent(new Event('visibilitychange')); } catch { /* no-op */ }
    // Keep the passive wrapper installed: site libraries may cache it at startup.
    // Remaining callbacks stay queued natively and can resume on the next lease.
  };
  const check = () => {
    if (!active || !hidden()) return;
    for (const id of [...frames.keys()]) {
      try { run(id, performance.now()); } catch (error) { console.error(error); }
    }
  };
  const renew = () => {
    expiresAt = Date.now() + 45000;
    if (!active) {
      active = true;
      for (const [name, descriptor] of [
        ['hidden', { configurable: true, get: () => false }],
        ['visibilityState', { configurable: true, get: () => 'visible' }],
        ['hasFocus', { configurable: true, value: () => true }]
      ] as Array<[string, PropertyDescriptor]>) {
        const original = Object.getOwnPropertyDescriptor(document, name);
        try {
          Object.defineProperty(document, name, descriptor);
          descriptors.push([name, original]);
        } catch { /* no-op */ }
      }
      try { document.dispatchEvent(new Event('visibilitychange')); } catch { /* no-op */ }
      try { window.dispatchEvent(new Event('focus')); } catch { /* no-op */ }
    }
    if (expiryTimer !== undefined) window.clearTimeout(expiryTimer);
    expiryTimer = window.setTimeout(stop, 45000);
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
    if (frame?.timer !== undefined) window.clearTimeout(frame.timer);
    frames.delete(id);
    cancelNative(id);
  };
  scope[key] = { renew, check, stop };
  document.addEventListener('__multiAiRoundtableFramesControlV2', (event) => {
    const command = (event as CustomEvent<string>).detail;
    if (command === 'start') { renew(); check(); }
    else if (command === 'stop') stop();
  });
}
