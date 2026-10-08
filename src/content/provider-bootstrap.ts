import type { ProviderId } from '../shared/types';

// The background checks tab ownership and pending work before waking the page.
const providers: Record<string, ProviderId> = {
  'chat.deepseek.com': 'deepseek',
  'www.kimi.com': 'kimi',
  'www.qianwen.com': 'qwen',
  'chatglm.cn': 'zhipu',
  'chatgpt.com': 'gpt',
  'gemini.google.com': 'gemini',
  'grok.com': 'grok',
  'wenxin.baidu.com': 'wenxin'
};
const provider = providers[location.hostname];
if (provider) void chrome.runtime.sendMessage({ type: 'PROVIDER_PAGE_BOOTSTRAP', provider }).catch(() => undefined);
