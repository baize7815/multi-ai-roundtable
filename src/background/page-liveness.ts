// The passive hook is installed in MAIN at document_start. Only managed work
// activates it; old pages receive the same hook as a best-effort fallback.
export async function updatePageFramePump(tabId: number, action: 'start' | 'check' | 'stop'): Promise<void> {
  const control = () => chrome.scripting.executeScript({
    target: { tabId },
    injectImmediately: true,
    world: 'MAIN',
    func: (command: 'start' | 'check' | 'stop') => {
      const state = (window as typeof window & Record<string, unknown>).__multiAiRoundtableFramesV2 as
        { renew: () => void; check: () => void; stop: () => void } | undefined;
      if (!state) return false;
      if (command === 'stop') state.stop();
      else { state.renew(); state.check(); }
      return true;
    },
    args: [action]
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      (async () => {
        if ((await control()).some((result) => result.result === true) || action === 'stop') return;
        await chrome.scripting.executeScript({
          target: { tabId }, world: 'MAIN', injectImmediately: true, files: ['content/page-liveness.js']
        });
        if (!(await control()).some((result) => result.result === true)) throw new Error('网页后台渲染辅助未就绪');
      })(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('网页后台渲染辅助无响应')), 4000); })
    ]);
  } finally { if (timer !== undefined) clearTimeout(timer); }
}
