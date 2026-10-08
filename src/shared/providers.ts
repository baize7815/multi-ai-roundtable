import type { ProviderCapabilities, ProviderId } from './types';

export interface ProviderDefinition {
  id: ProviderId;
  label: string;
  enabled: boolean;
  homeUrl?: string;
  urlPatterns?: string[];
  colorClass: string;
  iconFile?: string;
  capabilities: ProviderCapabilities;
}

export const PROVIDERS: ProviderDefinition[] = [
  {
    id: 'doubao',
    label: '豆包',
    enabled: true,
    homeUrl: 'https://www.doubao.com/chat',
    urlPatterns: ['https://www.doubao.com/chat*'],
    colorClass: 'provider-doubao',
    capabilities: { text: true, images: true, attachments: true, cancel: true }
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    enabled: true,
    homeUrl: 'https://chat.deepseek.com/',
    urlPatterns: ['https://chat.deepseek.com/*'],
    colorClass: 'provider-deepseek',
    capabilities: { text: true, images: true, attachments: true, cancel: true }
  },
  {
    id: 'kimi', label: 'Kimi', enabled: true,
    homeUrl: 'https://www.kimi.com/', urlPatterns: ['https://www.kimi.com/*'],
    colorClass: 'provider-kimi', capabilities: { text: true, images: true, attachments: true, cancel: true }
  },
  {
    id: 'qwen', label: '千问', enabled: true,
    homeUrl: 'https://www.qianwen.com/', urlPatterns: ['https://www.qianwen.com/*'],
    colorClass: 'provider-qwen', capabilities: { text: true, images: false, attachments: false, cancel: true }
  },
  {
    id: 'zhipu', label: '智谱清言', enabled: true,
    homeUrl: 'https://chatglm.cn/main/alltoolsdetail?lang=zh', urlPatterns: ['https://chatglm.cn/*'],
    colorClass: 'provider-zhipu', capabilities: { text: true, images: true, attachments: true, cancel: true }
  },
  {
    id: 'gpt', label: 'GPT', enabled: true,
    homeUrl: 'https://chatgpt.com/', urlPatterns: ['https://chatgpt.com/*'],
    colorClass: 'provider-gpt', capabilities: { text: true, images: true, attachments: true, cancel: true }
  },
  {
    id: 'gemini', label: 'Gemini', enabled: true,
    homeUrl: 'https://gemini.google.com/app', urlPatterns: ['https://gemini.google.com/*'],
    colorClass: 'provider-gemini', capabilities: { text: true, images: true, attachments: true, cancel: true }
  },
  {
    id: 'grok', label: 'Grok', enabled: true,
    homeUrl: 'https://grok.com/', urlPatterns: ['https://grok.com/*'],
    colorClass: 'provider-grok', capabilities: { text: true, images: true, attachments: true, cancel: true }
  },
  {
    id: 'wenxin', label: '文心', enabled: true,
    homeUrl: 'https://wenxin.baidu.com/', urlPatterns: ['https://wenxin.baidu.com/*'],
    colorClass: 'provider-wenxin', iconFile: 'wenxin.png',
    capabilities: { text: true, images: false, attachments: false, cancel: true }
  },
  {
    id: 'minimax', label: 'MiniMax', enabled: true,
    homeUrl: 'https://agent.minimax.cn/', urlPatterns: ['https://agent.minimax.cn/*'],
    colorClass: 'provider-minimax', iconFile: 'minimax.png',
    capabilities: { text: true, images: false, attachments: false, cancel: true }
  }
];

export const providerById = Object.fromEntries(PROVIDERS.map((provider) => [provider.id, provider])) as Record<ProviderId, ProviderDefinition>;
