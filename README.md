# Multi AI Roundtable

> 十个网页 AI，一个多智能体工作台。

直接使用已经登录的 AI 网页，让多个模型并发回答、轮流讨论、担任专家、参与社交推理游戏。**不需要单独申请各家 API Key。**

**作者：[@baize7815](https://github.com/baize7815)** · Chrome MV3 · TypeScript · 免费、非商业社区项目 · [English](README_EN.md)

> **公开发行版 v0.2.0**：包含 AI 对话、AI 圆桌、AI 专家团、AI 狼人杀与原创的 AI 迷雾议会五种模式。

## 项目亮点

- **10 个 AI 网页平台**：豆包、DeepSeek、Kimi、千问、智谱清言、ChatGPT、Gemini、Grok、文心、MiniMax。
- **AI 对话**：同一问题并发发送给多家 AI，快速比较不同模型的答案。
- **AI 圆桌**：严格按顺序接力、多轮循环，构建真正的模型间讨论。
- **AI 专家团**：给每个 AI 绑定独立的专家预设，让不同角色协作分析。
- **AI 狼人杀**：秘密身份、夜间行动、公开讨论与投票，由独立 GameEngine 裁决。
- **AI 迷雾议会**：原创的频道信号推理、公开辩论、密封投票与阵营计分。
- **稳定性设计**：扩展托管会话、后台持久化、中断与继续、私有上下文隔离、游戏回复仅最终提交。

## 五种模式

| 模式 | 适合做什么 | 调度方式 |
| --- | --- | --- |
| AI 对话 | 并发对比多个 AI 的回答 | 多 Provider 并发 |
| AI 圆桌 | 观点交锋、多轮接力 | 严格串行 |
| AI 专家团 | 多角度专家协作 | 独立预设 + 串行 |
| AI 狼人杀 | 社交推理、身份与投票 | 独立状态机 + 私密行动 |
| AI 迷雾议会 | 6–8 名 AI / 真人参与原创五轮信号推理 | 独立游戏状态机 + 私密线索 |

**普通三模式优先保持稳定。** 游戏使用独立运行时和专用网页窗口，不更改原有三模式的核心编排方式。

## 产品截图

仓库将在完成脱敏后加入真实 UI 截图：项目总览、并发 AI 对话、圆桌接力、专家团、狼人杀公开游戏视角、历史会话。暂不使用模拟图冒充产品实拍。截图规划及安全规范见 [docs/SCREENSHOTS.md](docs/SCREENSHOTS.md)。

## 支持的网站

| AI | 网站 |
| --- | --- |
| 豆包 | https://www.doubao.com/ |
| DeepSeek | https://chat.deepseek.com/ |
| Kimi | https://www.kimi.com/ |
| 千问 | https://www.qianwen.com/ |
| 智谱清言 | https://chatglm.cn/ |
| ChatGPT | https://chatgpt.com/ |
| Gemini | https://gemini.google.com/ |
| Grok | https://grok.com/ |
| 文心 | https://wenxin.baidu.com/ |
| MiniMax | https://agent.minimax.cn/ |

请自行登录所需网站并遵守对应平台条款。网站更新、登录失效、验证码或地区限制可能影响网页适配。文心和 MiniMax 当前只保证文字模式；图片与附件能力因 Provider 不同而有所限制。

## 安装

### 安装发行版

下载项目 Release 页面提供的 ZIP，解压后打开 Chrome 的 `chrome://extensions/`，开启开发者模式，点击 **加载已解压的扩展程序**，选择解压得到的 `dist/` 文件夹。尚未正式发布时请从源码构建。

### 从源码构建（Node.js 22+）

```bash
npm ci
npm run typecheck
npm run test:werewolf
npm run test:clocktower
npm run build
```

编译产物位于 `dist/`，可以直接在 Chrome 中作为未打包扩展加载。

## 技术架构

```text
Chrome Side Panel
       ↓
MV3 Service Worker / Persistent Session State
       ↓
AI Orchestrator + Game Engines + Visibility / Context Builder
       ↓
Managed Tabs + Provider-specific Content Scripts
       ↓
Real logged-in AI websites
```

普通协作模式按既有机制处理网页窗口；游戏模式通过独立的托管窗口控制活跃 AI，并避免将思考过程或不允许公开的游戏动作直接提交给其他角色。会话按 Provider 独立保存，支持中断、继续以及必要的异常恢复。

核心目录：`src/background/`、`src/content/`、`src/game/`、`src/sidepanel/`、`src/shared/`。测试：`tests/`。

## 隐私和法律说明

- **无需 API Key 不等于消息永远不离开浏览器。** 被选择的 AI 网站会接收发给它的提示词和上下文。
- 不需要将网页 Cookie、Token、密码或 Chrome 用户配置提供给项目作者。
- Issues、截图、Release 附件与调试日志不得包含个人聊天、账号标识、浏览器 Profile 或隐藏游戏资料。
- 本项目不隶属于所适配的 AI 服务提供商，各平台的名称和商标属于相应权利人。
- **AI 迷雾议会** 为本项目原创游戏模式。先前本地实验性第三方剧本未纳入本次公开源码或发行包。详见 [发布检查表](docs/RELEASE_CHECKLIST.md)。

## 参与与署名

项目由 **[@baize7815](https://github.com/baize7815)** 原创开发。欢迎提交有复现步骤的 Issue、适配修复和代码改进；请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md)、[SECURITY.md](SECURITY.md) 和 [NOTICE](NOTICE)。

本项目原创代码基于 [Apache License 2.0](LICENSE) 开源。再分发需依法保留版权、许可证和适用的 NOTICE 归属声明，并标明所作修改。

如果项目对你有帮助，欢迎关注、分享和提出改进建议，并在改造发布时保留适用许可证要求的原作者署名。
