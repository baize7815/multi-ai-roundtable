// Start before the site's initial render can enqueue suspended animation frames.
// The background permits this only for extension-managed tabs with active work.
void chrome.runtime.sendMessage({ type: 'PROVIDER_PAGE_BOOTSTRAP', provider: 'doubao' }).catch(() => undefined);
