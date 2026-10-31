# Multi AI Roundtable (v0.2.0) 项目全面深度测评与架构整改报告

**测评对象**：`baize7815/multi-ai-roundtable`（Chrome Manifest V3 侧边栏扩展，v0.2.0）
**代码规模**：约 15,500 行（含 TypeScript 核心源码、10 大 AI 平台 Content Script 适配器、双推理游戏状态机引擎及回归测试套件）
**报告目标**：从**操作性、实用性、功能性、性能表现、UI 美观度与空间布局**五个维度进行源码级深度剖析，重点解答**浏览器后台惰性回复与自动接收机制隐患**、**侧边栏顶部五模式图标间距与窄屏适配问题**、**多轮对话与游戏状态机逻辑合理性**，并按 **P1（致命/阻塞级）至 P4（优化/演进级）** 给出可直接落地的代码级整改方案与新增功能蓝图。

---

## 一、 项目五维全景测评总览

Multi AI Roundtable 采用了一个极具巧思的轻量化架构：**不依赖任何第三方 API Key 或自建后端服务，直接复用用户在浏览器中已登录的 10 个主流 AI 网页会话**（豆包、DeepSeek、Kimi、千问、智谱清言、ChatGPT、Gemini、Grok、文心一言、MiniMax），通过 Chrome Side Panel 统一调度并行问答（AI 对话）、串行接力（AI 圆桌）、角色分工（专家团）以及隐藏信息社交推理游戏（AI 狼人杀、AI 迷雾议会）。

| 测评维度 | 综合评分 (10分制) | 核心亮点 | 关键痛点与短板 |
| :--- | :--- | :--- | :--- |
| **实用性 (Practicality)** | **8.8 / 10** | 零 API 成本聚合 10 大主流模型；兼顾日常生产力（多模型交叉验证、圆桌头脑风暴、专家评审）与娱乐推理（狼人杀/迷雾议会）；支持会话导出为 Markdown 与专家预设 JSON 导入导出。 | 缺少多模型回答的「一键汇总/裁判收敛」能力；部分平台（千问/文心/MiniMax）不支持图片与附件转发且缺少发送前拦截提示；专家团默认无内置模板，冷启动门槛高。 |
| **功能性 (Functionality)** | **8.2 / 10** | 状态机设计扎实，具备 `operationId` 幂等保护、断线基线恢复（Response Baseline）、玩家发言防提示词注入转义（Prompt Injection Escaping）及狼人杀单次格式修复（Format Repair）。 | 圆桌/专家团首轮首位发言 Prompt 存在语病且缺少全局议程/轮次感知；迷雾议会动作解析过于死板且无重试机制（单次格式偏差即永久锁死对局）；AI 对话模式缺少「中断生成」按钮。 |
| **操作性 (Operability)** | **7.5 / 10** | 侧边栏即开即用，支持粘贴图片、轮数滑块调节、人类玩家直接参战狼人杀/议会；设置面板提供实时绿/红/灰连接状态点检测。 | 专家团配置路径割裂（需在顶栏灯泡弹窗建预设，再去齿轮设置里的「AI 圆桌」区块绑定）；流式输出时全量重建 DOM 导致用户无法滚动阅读或选中文本；删除卡死会话存在死锁。 |
| **性能表现 (Performance)** | **6.8 / 10** | 针对 Chrome 后台标签页休眠设计了四层保活机制（MAIN 世界 `rAF` 劫持 + `navigator.locks` + Runtime Port + 前台轮播/私密小窗）；单元测试覆盖核心纯函数。 | **存在严重的 `chrome.storage.local` 写放大风暴**（每次流式 Token Delta 均触发全量状态读写与全量 DOM 重建）；未声明 `unlimitedStorage` 权限，带 Base64 附件极易撑爆 10MB 存储配额；关闭「回复加速」后存在 12–20 秒人为延迟 Bug。 |
| **UI 美观度 (UI & Layout)** | **7.4 / 10** | 整体采用柔和浅色现代卡片风格，为 10 个模型定制了专属高辨识度气泡底色；抽屉式遮罩与消息气泡排版清爽。 | **顶栏 5 个模式图标在默认窄侧边栏（320px–380px）下留白失衡且采用绝对定位易与右侧按钮碰撞**；图标无文字标签导致认知负担高；`迷雾议会.svg` 与其余 4 个线性图标风格割裂；迷雾议会局内 UI 缺少头像、色彩与 Markdown 渲染。 |

---

## 二、 深度专题剖析一：浏览器自动接收回复机制与后台惰性/降频问题

### 2.1 现有四层保活与接收架构梳理

为了解决浏览器扩展通过 DOM 自动化读取 AI 网页回复时面临的「后台标签页休眠、渲染暂停、计时器节流」问题，项目目前构建了四层防御机制：

1. **第一层：MAIN World 渲染帧泵与可见性伪装（`src/content/page-liveness.ts`）**
   在 `document_start` 阶段注入主世界（`MAIN` world），通过 `Object.defineProperty` 将 `document.hidden` 伪装为 `false`、`document.visibilityState` 伪装为 `'visible'`、`document.hasFocus` 伪装为 `() => true`，并劫持 `window.requestAnimationFrame`，在页面实际处于后台时通过 `window.setTimeout(..., 350)` 强制驱动渲染帧回调（每次续期 45 秒）。
2. **第二层：Web Locks 锁与长连接保活（`src/content/common.ts`）**
   在 `beginOperationKeepAlive()` 中同时建立 `chrome.runtime.connect({ name: 'provider-operation' })`（每 15 秒心跳防止 MV3 Service Worker 休眠）并申请 `navigator.locks.request(...)` Web Lock，阻止 Chrome Energy Saver（节能模式）冻结或丢弃（Discard）后台标签页。
3. **第三层：前台标签页轮播租约调度器（`src/background/reply-foreground.ts`）**
   当开启「启用回复加速」（默认开启）时，针对普通对话模式（对话/圆桌/专家团），后台每隔 `4000ms` 自动调用 `chrome.tabs.update(next.tabId, { active: true })` 轮流将正在生成的 AI 标签页切到前台激活；若用户手动切换了标签页，则将 `lease.manual` 置为 `true`，暂停本轮自动切页。
4. **第四层：边缘露角私密游戏窗口（`src/background/private-game-pages.ts`）**
   由于狼人杀和迷雾议会包含隐藏身份与私密信号，不能在主窗口前台切页（否则人类玩家或观众会直接看到 AI 网页里的狼人讨论或底牌），扩展专门创建了一个 `420×320` 的独立窗口，推到主窗口右下角边缘仅露出 `24px`（`EDGE_PEEK = 24`）且不抢焦点（`focused: false`），空闲时将其最小化（`state: 'minimized'`）。

### 2.2 深度漏洞诊断：现有机制为什么仍会出现「惰性回复过慢、卡死或截断」？

经过对源码的逐行审计，这套看似严密的机制在实际浏览器运行环境中存在 **5 个深层漏洞与边界失效场景**：

#### 漏洞 1：关闭「回复加速」会触发代码逻辑 Bug，导致大多数模型回复完成后被强制卡住 12–20 秒（P1）
在 `src/content/common.ts` 第 215–229 行的 `responseCompletionReady()` 函数中：
```typescript
export function responseCompletionReady(options: {
  lastChangeAt: number;
  explicitComplete?: boolean;
  generationActive?: boolean;
  observedGenerationComplete?: boolean;
  visibleFallbackMs?: number;
  hiddenFallbackMs?: number;
}): boolean {
  if (options.generationActive) return false;
  const quietFor = Date.now() - options.lastChangeAt;
  // 【致命逻辑缺陷】：为什么 observedGenerationComplete 要受 replyAccelerationEnabled 限制？！
  if ((options.explicitComplete || (replyAccelerationEnabled && options.observedGenerationComplete)) && quietFor >= 1000) return true;
  const fallbackMs = document.visibilityState === 'hidden'
    ? (options.hiddenFallbackMs ?? 20000)
    : (options.visibleFallbackMs ?? 15000);
  return quietFor >= fallbackMs;
}
```
* **问题根因**：`gpt.ts`、`gemini.ts`、`grok.ts`、`zhipu.ts` 四个核心平台在调用 `responseCompletionReady` 时，**只传入了 `observedGenerationComplete: sawGeneration && !generating`（即观察到「停止生成」按钮出现后又消失），而没有传入 `explicitComplete`**。
* **严重后果**：
  1. 当用户在设置中关闭「启用回复加速」（因为不想让浏览器每隔 4 秒自动乱切前台标签页）时，`replyAccelerationEnabled` 变为 `false`。此时 `(options.explicitComplete || (replyAccelerationEnabled && options.observedGenerationComplete))` 恒为 **`false`**！
  2. 此外，在游戏模式（狼人杀/迷雾议会）下，标签页在后台运行，而在 Content Script 所在的 `ISOLATED` 世界中，`document.visibilityState` 依然是原生值 `'hidden'`（因为 `page-liveness.ts` 在 `MAIN` 世界对 `document` 实例属性的 `Object.defineProperty` 仅修改了 `MAIN` 世界的 V8 JS Wrapper，不会穿透到 `ISOLATED` 世界的 Content Script `document` Wrapper！）。
  3. 结果就是：哪怕 ChatGPT、Gemini、Grok、智谱清言已经 100% 生成完毕且「停止按钮」早已消失，只要用户关了「回复加速」，每个模型在每轮发言结束后都会**白白干等 12 秒（前台）或 20 秒（后台）**才触发 `PROVIDER_RESPONSE_COMPLETED`！在一局 6 人圆桌或狼人杀中，这会凭空增加 **3 到 5 分钟的无意义卡顿**，让用户误以为浏览器惰性导致回复极慢！

#### 漏洞 2：开启「回复加速」时，`quietFor >= 1000`（1 秒静默判定）在深度思考/工具调用模型下极易造成「半截抢跑截断」（P1）
* **问题根因**：当 `replyAccelerationEnabled` 为 `true` 时，只要 `!generationActive` 且文本在 `1000ms`（1 秒）内没有变化，就会立即判定回复完成。
* **严重后果**：如今主流 AI 网页（DeepSeek R1、ChatGPT Thinking/Search、Gemini Thinking、Kimi 联网搜索、豆包边想边搜）普遍采用「多阶段流式输出」（先搜索网页/执行代码 -> 思考推理 -> 输出正文）。在阶段切换的瞬间，部分前端框架（React/Vue）会卸载旧状态组件并挂载新组件，导致「停止生成」按钮在 DOM 中短暂消失几百毫秒，或者部分平台的停止按钮选择器因样式微调未命中（`generationActive` 返回 `false`）。此时若模型因网络抖动或首 Token 延迟停顿超过 **1 秒**，扩展就会立刻把刚刚输出了半句话的残缺内容当成最终回复提交，直接推进下一位 AI 发言！

#### 漏洞 3：Chrome 后台强力计时器节流（Intensive Wake Up Throttling）会穿透 `page-liveness.ts` 的 `setTimeout`（P2）
* **问题根因**：在 `src/content/page-liveness.ts` 中，当页面处于后台时，脚本使用 `window.setTimeout(..., 350)` 来替代 `requestAnimationFrame`。同时，`src/content/common.ts` 中的 `waitForDomMutation(timeoutMs = 1000)` 也依赖 `window.setTimeout(finish, timeoutMs)` 作为兜底轮询。
* **严重后果**：
  1. 虽然 `common.ts` 申请了 `navigator.locks` 防止标签页被完全冻结（Frozen），但根据 Chromium 调度器规范，**后台标签页中嵌套深度 $\ge 5$ 的 `setTimeout` 会被强制节流至最低 1000ms，而在隐藏超过 5 分钟或位于最小化窗口时，Intensive Wake Up Throttling 会将主线程计时器节流至 60,000ms（1 分钟才触发一次）**！
  2. 如果某个 AI 网页前端（例如豆包、MiniMax、千问的虚拟列表或流式打字机缓冲器）依赖 `setTimeout` 或 `requestAnimationFrame` 将 WebSocket/SSE 收到的数据块刷入 DOM，一旦该标签页在后台停留超过 5 分钟，其渲染缓冲器就会陷入长达 1 分钟的假死。
  3. 而在 `src/background.ts` 中，`acceleratePendingReplies` 每 4 秒才由 Service Worker 唤醒一次 `startPageFramePump`，在两次脉冲之间的 4 秒空窗期内，依赖高频 `rAF`（60Hz）排空流式队列的前端打字机只能推进一帧，导致长文生成在后台变成「挤牙膏」。

#### 漏洞 4：私密游戏窗口（`private-game-pages.ts`）受制于操作系统原生窗口遮挡检测（Native Window Occlusion）与全屏桌面跳屏（P2）
* **问题根因**：`src/background/private-game-pages.ts` 将游戏窗口设为 `420×320`，放置在 `left: left! + width! - 24, top: top! + height! - 24` 且 `focused: false`。
* **严重后果**：
  1. **Windows / macOS 原生窗口遮挡计算（Native Window Occlusion）**：当用户的日常浏览器主窗口处于**最大化（Maximized）**状态时，这个 `focused: false` 的游戏后台小窗完全位于主窗口图层下方（被 100% 遮挡）。現代 Chrome 默认开启了 `CalculateNativeWinOcclusion`，一旦 OS 合成器判定该窗口被前置最大化窗口完全遮挡，即便其窗口状态是 `state: 'normal'` 且标签页是 `active: true`，Chromium 依然会将其视为不可见（Occluded）并停止合成帧（`requestAnimationFrame` 降为 0 FPS）！
  2. **macOS 全屏空间（Full Screen Spaces）跳屏干扰**：在 macOS 上，如果用户在全屏 Space 下使用 Chrome，扩展调用 `chrome.windows.update(windowId, { state: 'normal', left, top })` 会导致 macOS 桌面空间发生强制滑动切屏或弹窗闪烁。

#### 漏洞 5：前台轮播加速（`reply-foreground.ts`）抢占用户视线，且一旦用户手动点一下标签页就彻底罢工（P2）
* **问题根因**：在 `src/background/reply-foreground.ts` 中，当用户使用「AI 对话」同时向 4–6 个模型提问时，扩展每隔 4 秒强制切换当前窗口的激活标签页（`chrome.tabs.update(next.tabId, { active: true })`）。
* **严重后果**：
  1. 用户在侧边栏看回复时，左侧主浏览器画面每隔 4 秒就像幻灯片一样来回闪烁跳转不同 AI 网站，视觉干扰极强。
  2. 如果用户想在等待 AI 回复期间看一眼自己的资料网页（手动点击了某个 Tab），`onActivated` 立即将 `lease.manual = true` 锁死，**在整场多轮会话结束前再也不会恢复后台标签页的唤醒调度**，且没有任何 UI 状态提示用户「回复加速已因手动切页而暂停」。

### 2.3 针对浏览器自动接收与后台惰性机制的根治方案（可直接落地）

#### 方案 A：修复 `responseCompletionReady` 判定逻辑，解耦 `replyAccelerationEnabled` 并引入自适应防抖（修改 `src/content/common.ts`）
```typescript
// src/content/common.ts 替换 responseCompletionReady 实现
export function responseCompletionReady(options: {
  lastChangeAt: number;
  explicitComplete?: boolean;
  generationActive?: boolean;
  observedGenerationComplete?: boolean;
  visibleFallbackMs?: number;
  hiddenFallbackMs?: number;
}): boolean {
  // 1. 只要检测到停止按钮或流式标记仍在活跃，绝不提前完成
  if (options.generationActive) return false;
  const quietFor = Date.now() - options.lastChangeAt;

  // 2. 明确完成标记（如复制/重成按钮已挂载）：要求至少 1500ms 文本静默，防止打字机尾帧未刷完
  if (options.explicitComplete && quietFor >= 1500) return true;

  // 3. 观察到生成状态从 active 变为 inactive（停止按钮消失）：
  // 无论是否开启 replyAccelerationEnabled 都应生效！但静默窗口提高到 2500ms，防止思考模型阶段切换闪烁误判
  if (options.observedGenerationComplete && quietFor >= 2500) return true;

  // 4. 兜底静默超时：统一为 12000ms（前台）/ 15000ms（后台）
  const fallbackMs = document.visibilityState === 'hidden'
    ? (options.hiddenFallbackMs ?? 15000)
    : (options.visibleFallbackMs ?? 12000);
  return quietFor >= fallbackMs;
}
```

#### 方案 B：用 `MessageChannel` + 后台高频脉冲替代 `page-liveness.ts` 中易被节流的 `setTimeout(..., 350)`（修改 `src/content/page-liveness.ts`）
在 `src/content/page-liveness.ts` 中，当 `check()` 被调用时，不应只执行单次帧回调，而应在 500ms 窗口内通过 `MessageChannel` 或短间隔连续泵出 5–8 帧，让 React/ProseMirror/虚拟列表一次性完成多步状态提交与 DOM 挂载：
```typescript
// src/content/page-liveness.ts 中增强 check() 为连续多帧脉冲泵
const check = () => {
  if (!active || !hidden()) return;
  // 单次唤醒时连续驱动 4 轮帧队列（间隔 40ms），确保 React 状态机与虚拟列表完成多阶段渲染
  let bursts = 0;
  const pumpBurst = () => {
    for (const id of [...frames.keys()]) {
      try { run(id, performance.now()); } catch (error) { console.error(error); }
    }
    bursts += 1;
    if (bursts < 4 && frames.size > 0) {
      window.setTimeout(pumpBurst, 40);
    }
  };
  pumpBurst();
};
```

#### 方案 C：将「前台切页加速」拆分为三档可控策略，默认改为「仅后台脉冲 + 卡死时瞬时唤醒」（修改 `src/shared/types.ts` 与 `src/background/reply-foreground.ts`）
建议将单一布尔值 `replyAcceleration: boolean` 升级为三档枚举 `replyAccelerationMode: 'background_pump' | 'smart_wake' | 'foreground_rotate'`：
* **`background_pump`（推荐默认）**：全程不抢占、不切换用户的前台标签页，仅通过后台高频 `pageFramePump`（将间隔从 `4000ms` 缩短至 `1500ms`）+ `Web Locks` 保活。
* **`smart_wake`（智能防卡死唤醒）**：平时不切前台标签页；仅当某个 Provider 超过 **12 秒** 未收到首字或流式中断时，才短暂唤醒该标签页 `300ms` 触发渲染后立即切回原标签页。
* **`foreground_rotate`（极速前台轮播）**：保留现有的 4 秒前台轮播，适合用户挂机观看多 AI 回答的场景。

---

## 三、 深度专题剖析二：顶部五功能 UI 图标间距与窄侧边栏适配问题

### 3.1 像素级空间测算：为什么现在 5 个图标显得「间距太大」且在窄侧边栏下局促？

用户敏锐地指出了核心 UI 痛点：**「现在五个功能的 UI 图标间距是否太大了，因为侧边栏一般不会开很大」**。我们对 `src/sidepanel/styles.css` 与 `src/sidepanel/index.html` 进行了精确的像素级几何测算：

1. **Chrome 侧边栏默认宽度仅为 `360px`（最窄可拖至 `300px–320px`）**。
2. **当前 `.topbar` 的水平空间占用测算（见 `src/sidepanel/styles.css` 第 35–85 行）**：
   * 左侧操作区 `.topbar-left-actions`：「新会话」(`32px`) + 「全屏打开」(`32px`) + `gap: 2px` = **`66px`**。
   * 右侧操作区 `.topbar-actions`：「专家团预设」(`32px`) + 「会话管理」(`32px`) + 「设置」(`32px`) + `gap: 4px` = **`100px`**。
   * 中间模式切换栏 `.mode-tabs`：
     * 默认断点（`>390px`）：5 个按钮 × `width: 44px` (`220px`) + 4 个 `gap: 3px` (`12px`) + 左右 `padding: 6px` = **`238px`**。
     * 总宽度需求：`66px + 238px + 100px + 左右内边距 20px` = **`424px`**！
3. **三大结构性设计缺陷**：
   * **缺陷一：图标本体太小（`16px`）而按钮容器太宽（`44px`），导致图标之间出现 `31px` 的巨大视觉空洞**。
     在 `.mode-tab` 中，`width: 44px`，而内部的 `img` 仅有 `16px × 16px`（`padding: 7px 10px`）。这意味着每个图标左右各有 `14px` 留白，加上按钮间距 `3px`，**相邻两个 `16px` 图标之间的空白距离高达 `14 + 3 + 14 = 31px`（接近图标自身宽度的 2 倍！）**。在视觉心理学（格式塔接近性原则）上，这会导致 5 个图标显得松散、空旷，同时又把整个胶囊容器撑得过宽（`238px`）。
   * **缺陷二：`.mode-tabs` 使用了 `position: absolute; left: 50%; transform: translateX(-50%)` 脱离文档流，导致在 `340px–420px` 宽度下与右侧按钮直接重叠碰撞**！
     因为左侧只有 2 个按钮（`66px`），右侧有 3 个按钮（`100px`），左右是不对称的！强行把 `.mode-tabs` 绝对居中于 `50%`，会导致在 `350px–415px` 宽度区间内，`.mode-tabs` 的右半部分直接侵入右侧 `.topbar-actions` 区域（距离仅剩几像素甚至重叠），而左侧却空出一截无用留白。
   * **缺陷三：5 个纯图标无任何文字提示，且第 5 个图标（`迷雾议会.svg`）视觉风格严重违和**。
     前 4 个图标（对话、圆桌、专家团、狼人杀）均为 `20×20` 的单色细线条图标（`#1D1D1D`），而第 5 个 `SVG/迷雾议会.svg` 却是 `64×64` 的**蓝紫渐变实心圆角方块图标**！放在同一排胶囊导航里显得格格不入。同时，5 个纯图标对新用户而言语义不明，必须鼠标悬停等待系统 `title` 提示才能分辨。

### 3.2 顶栏与五模式导航 UI 彻底重构方案（紧凑胶囊 + 激活态展开文字标签）

**核心设计思路由「等宽宽间距纯图标」改为「紧凑图标 + 当前激活项显示文字标签（Active Pill Label）」**：
* 未激活的 4 个模式按钮仅宽 `28px`（图标 `16px`，左右内边距仅 `6px`，图标间距从 `31px` 压缩至紧凑舒适的 `14px`）。
* **当前选中的模式按钮自动展开显示精简文字标签**（如 `[图标 AI 圆桌]`），既解决了纯图标看不懂的问题，又将整个 `.mode-tabs` 的总宽度从 `238px` 降低至 **`190px–202px`**！
* 移除 `position: absolute; left: 50%`，改用标准 Flexbox 弹性居中布局，彻底消除与右侧 3 个按钮的重叠风险。
* 将「专家团预设」按钮（灯泡图标）仅在切换到「专家团」模式时高亮或移入专家团专属配置条，进一步释放顶栏右侧空间。

#### 可直接替换的 HTML 与 CSS 代码（`src/sidepanel/index.html` & `src/sidepanel/styles.css`）

**1. 修改 `src/sidepanel/index.html` 中的 `.mode-tabs` 结构（增加 `<span>` 短标签）：**
```html
<nav class="mode-tabs" aria-label="模式切换">
  <button class="mode-tab active" data-mode="qa" aria-label="AI 对话" title="AI 对话">
    <img src="../SVG/AI 对话.svg" alt="" /><span class="mode-tab-label">对话</span>
  </button>
  <button class="mode-tab" data-mode="roundtable" aria-label="AI 圆桌" title="AI 圆桌">
    <img src="../SVG/AI 圆桌.svg" alt="" /><span class="mode-tab-label">圆桌</span>
  </button>
  <button class="mode-tab" data-mode="expert" aria-label="专家团" title="专家团">
    <img src="../SVG/专家团.svg" alt="" /><span class="mode-tab-label">专家团</span>
  </button>
  <button class="mode-tab" data-mode="werewolf" aria-label="狼人杀" title="狼人杀">
    <img src="../SVG/狼人杀.svg" alt="" /><span class="mode-tab-label">狼人杀</span>
  </button>
  <button class="mode-tab" data-mode="fog_council" aria-label="迷雾议会" title="迷雾议会">
    <img src="../SVG/迷雾议会.svg" alt="" /><span class="mode-tab-label">议会</span>
  </button>
</nav>
```

**2. 修改 `src/sidepanel/styles.css` 中的 `.topbar` 与 `.mode-tabs` 样式：**
```css
.topbar {
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--line);
  background: rgba(255, 255, 255, .92);
  backdrop-filter: blur(16px);
}

/* 移除 position: absolute，采用标准 Flex 居中，永不与左右按钮重叠 */
.mode-tabs {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border-radius: 10px;
  background: rgba(30, 35, 50, 0.055);
  flex: 0 1 auto;
  min-width: 0;
}

.mode-tab {
  height: 30px;
  min-width: 28px;
  padding: 0 6px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  white-space: nowrap;
  transition: background-color 0.16s ease, color 0.16s ease, padding 0.16s ease;
}

.mode-tab img {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  display: block;
  opacity: .62;
}

.mode-tab-label {
  display: none;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
}

.mode-tab.active {
  padding: 0 9px;
  background: #fff;
  color: var(--text);
  box-shadow: 0 1px 4px rgba(18, 23, 38, .09);
}

.mode-tab.active img {
  opacity: 1;
}

.mode-tab.active .mode-tab-label {
  display: inline;
}

/* 极窄屏（<=340px）自动隐藏文字标签，退化为超紧凑纯图标栏（总宽仅 148px） */
@media (max-width: 340px) {
  .mode-tab.active .mode-tab-label {
    display: none;
  }
  .mode-tab, .mode-tab.active {
    padding: 0 5px;
    min-width: 26px;
  }
}
```

**3. 统一 `SVG/迷雾议会.svg` 为 20×20 单色线性图标（消除实心色块违和感）：**
```xml
<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="10" cy="7.5" r="2.2" stroke="#1D1D1D" stroke-width="1.5"/>
  <path d="M5.2 11.8a5.5 5.5 0 0 1 9.6 0" stroke="#1D1D1D" stroke-width="1.5" stroke-linecap="round"/>
  <path d="M3 14.2c2.2-1.8 4.2-1.8 7 0s4.8 1.8 7 0" stroke="#1D1D1D" stroke-width="1.5" stroke-linecap="round"/>
  <path d="M5 17c1.8-1.4 3.2-1.4 5 0s3.2 1.4 5 0" stroke="#1D1D1D" stroke-width="1.5" stroke-linecap="round"/>
</svg>
```

---

## 四、 深度专题剖析三：五大模式对话流程与状态机逻辑合理性审计

### 4.1 AI 圆桌 & 专家团：串行上下文构造的 4 个逻辑缺陷（`src/background/orchestrator.ts`）

我们重点审查了 `src/background/orchestrator.ts` 第 48–68 行的 `buildSequentialPrompt()` 与 `withExpertPreset()`，发现其多轮对话接力逻辑存在以下不合理之处：

1. **首轮第 1 位发言模型的 Prompt 语义矛盾**：
   ```typescript
   const body = unseen.length
     ? unseen.map((message) => `【${message.role === 'user' ? '用户' : expertDisplayLabel(session, message.provider)}】\n${message.text}`).join('\n\n')
     : '请继续讨论，补充新的观点。';
   return `${body}\n\n请基于以上你尚未看到的新增内容继续讨论。避免复述已有内容，直接回应并推进讨论。`;
   ```
   当第 1 轮的第 1 个模型（如豆包）收到用户的初始提问时，此前没有任何 AI 发言，但扩展依然在用户问题下方追加了：`「请基于以上你尚未看到的新增内容继续讨论。避免复述已有内容，直接回应并推进讨论。」`——这不仅话术别扭，还会让部分推理模型误以为前面缺失了对话上下文。
2. **完全缺失「圆桌议程感知（Round & Roster Awareness）」导致尾轮无法收敛**：
   在实机截图（`AI 圆桌.webp` 和 `专家团.webp`）中可以明显看到：**即使到了第 2/2 轮的最后一位 AI 发言，AI 依然在结尾向其他模型或用户抛出开放式反问（如“你更偏向哪一类？”“当一个人说我热爱生活时…”）**，因为模型根本不知道：
   * 当前处于第几轮、总共几轮（`roundIndex + 1 / targetRounds`）；
   * 桌面上有哪些参与者/专家角色；
   * 当前是否是最后一轮的收官发言（最后一轮应要求模型进行观点交锋收敛与总结，而不是继续发散提问）。
3. **标签页重建后专家身份（Expert Persona）丢失漏洞**：
   `withExpertPreset()` 通过 `session.expertInitializedProviders` 记录哪些模型已经注入过专家设定，后续轮次不再重复注入。但如果某个模型的浏览器标签页在第 2 轮前被用户误关或崩溃，`resolveProviderTab()` 会新建一个空白标签页。此时由于 `expertInitializedProviders` 仍包含该模型 ID，**新标签页既拿不到第 1 轮的用户原始问题，也拿不到专家预设 Prompt**，直接导致该模型「失忆且丢掉专家人设」！
4. **控制器存在 190 行废弃的前台调度死代码（`src/sidepanel/controller.ts`）**：
   `controller.ts` 第 702–757 行（`waitForProvider`, `onProviderEvent`, `ensureSessionBindings`）与第 825–891 行（`runSequential`, `interruptSequential`）是早期版本在侧边栏前台跑循环的残留代码，现已迁入 `background/orchestrator.ts`，留在 `controller.ts` 中不仅增加包体积，还造成了状态维护认知混淆。

### 4.2 AI 狼人杀：状态机与提示词逻辑审计（`src/background/werewolf-engine.ts`）

1. **第一夜女巫自救开启时，Prompt 错误将女巫自己列为「毒药（POISON）合法目标」（Bug）**：
   * 在 `src/background/werewolf-engine.ts` 第 284 行：
     `const allowed = alive().filter((target) => target !== seat || (target === game.night.wolfTarget && game.day === 1 && game.rulesetSnapshot.allowWitchSelfSaveFirstNight));`
   * 在 `src/game/werewolf/context.ts` 第 83 行：
     `const poisonRule = expectedActions.includes('poison') && allowedTargets.length ? 'POISON 合法目标：' + allowedTargets.join('、') + '。' : '';`
   * **后果**：当第一夜狼人恰好刀了女巫时，`allowedTargets` 包含了女巫自己的座位号。`machineActionInstruction` 直接在 Prompt 中告诉 AI 女巫：`POISON 合法目标：1、2、3（含女巫自己）`！一旦 AI 选择毒自己，引擎层的 `specialActionError` 就会报错 `女巫不能毒自己`，白白触发一次 `FORMAT REPAIR` 甚至导致本局暂停！
2. **白天投票阶段 UI 宣称「同时提交」，实则为「严格串行等待」（体验割裂）**：
   * `controller.ts` 第 326 行提示人类玩家：`「请选择投票目标。所有存活玩家同时提交，全部完成后统一公布票型。」`
   * 但 `werewolf-engine.ts` 第 346 行 `day_vote` 实际上是按座位号从 1 号到 8 号**严格串行逐个请求 AI 网页**（因为担心多个后台网页并发抢占状态）。如果人类玩家坐在 6 号位，必须干等 1–5 号 AI 依次打开网页生成完投票后，人类玩家的投票按钮才会渲染出来！
   * **优化逻辑**：进入 `day_vote` 或 `day_tiebreak_vote` 时，若人类玩家存活且尚未投票，**应立即在进入阶段的第一时间激活 `game.pendingHumanAction`**，让人类玩家随时点击投票，而后台 AI 玩家继续按队列串行完成投票，互不阻塞！
3. **删除狼人杀对局未关闭后台私密标签页，造成严重内存泄漏**：
   * `fog-council-engine.ts` 的 `deleteGame` 会遍历 `game.bindings` 关闭所有标签页；而 `werewolf-engine.ts` 第 551 行的 `deleteGame` 只删了 `state.werewolfGames` 数组记录，**完全没有关闭该局创建的 6–8 个独立 AI 网页标签页**！玩 3 局狼人杀就会在隐藏窗口里残留 20 多个 AI 网页标签页，耗尽系统内存。

### 4.3 AI 迷雾议会：容错缺失导致极易死局（`src/background/fog-council-engine.ts`）

1. **零容错的动作解析器 + 无 Format Repair 重试 + 暂停后不可恢复（严重缺陷）**：
   * 在 `src/game/fog-council/actions.ts` 中，`parseCouncilFinalAnswer` 要求投票阶段必须严格匹配 `/^\[\[COUNCIL:VOTE:([ABC])\]\]$/`（多一个句号、代码块、加粗星号或一行解释都会直接抛异常），发言阶段最后一行必须严格等于 `[[COUNCIL:SPEAK]]`。
   * 一旦某个网页 AI 在发言末尾忘了写 `[[COUNCIL:SPEAK]]`（或紧跟在文字后面没换行），或者在投票前多说了一句分析，`fog-council-engine.ts` 第 185 行直接调用 `pauseOnError()`。
   * 而 `pauseOnError()` 故意保留了 `game.pendingTurn`，导致用户点击「继续」按钮时，`resumeGame()`（第 219 行）直接抛出异常：`「之前的网页操作尚未确认完成，为避免重复发送，不能直接继续；请新开一局」`！这意味着**整局 6–8 人、30 次 AI 交互中，只要任何一次 AI 格式稍微偏离，整局游戏就彻底报废**！

---

## 五、 P1 – P4 轻重等级问题清单与完整整改方案

以下按 **P1（致命/紧急） → P2（重要缺陷） → P3（体验与交互优化） → P4（架构演进与新增功能）** 排序，给出所有发现的漏洞、整改建议与可直接落地的代码方案。

### 5.1 等级总览矩阵

| 等级 | 编号 | 模块 | 问题 / 建议简述 | 核心影响 |
| :---: | :---: | :--- | :--- | :--- |
| **P1** | **P1-1** | `common.ts` | 关闭「回复加速」导致 GPT/Gemini/Grok/智谱每轮强制卡顿 12–20 秒；开启时 1 秒静默过早截断思考模型 | 回复极慢或半截抢跑截断 |
| **P1** | **P1-2** | `orchestrator.ts` / `manifest.json` | 流式输出每个 Delta 触发 `chrome.storage.local` 全量读写与全量 DOM 重建；缺少 `unlimitedStorage` 权限导致上传图片必崩 | 界面严重卡顿、无法复制文字、10MB 配额崩溃 |
| **P1** | **P1-3** | `fog-council/actions.ts` & `engine.ts` | 迷雾议会动作解析零容错、无自动重试，且 `pauseOnError` 后禁止「继续」导致单次格式偏差即死局 | 迷雾议会模式实机完局率极低 |
| **P1** | **P1-4** | `sidepanel/controller.ts` | AI 对话（QA）模式无「中断」按钮，一旦某个网页卡住，用户既无法停止也无法删除/新建会话（死锁） | 会话操作死锁 |
| **P2** | **P2-1** | `sidepanel/styles.css` & `index.html` | 顶栏 5 个模式图标间距过大（`31px` 留白）、绝对定位在窄侧边栏重叠、无文字标签、`迷雾议会.svg` 风格违和 | 窄侧边栏拥挤重叠、辨识度低 |
| **P2** | **P2-2** | `orchestrator.ts` | 圆桌/专家团首轮首位发言 Prompt 语病、缺少参与者名单与轮次/收官指令、标签页重建后丢失专家人设 | 多轮讨论逻辑断层、尾轮不收敛 |
| **P2** | **P2-3** | `werewolf-engine.ts` & `context.ts` | 狼人杀删除对局泄漏 6–8 个后台标签页；女巫首夜自救时将自己列为毒药合法目标；人类投票被 AI 串行阻塞 | 内存严重泄漏、女巫动作报错重试 |
| **P2** | **P2-4** | `page-liveness.ts` & `private-game-pages.ts` | 后台 `setTimeout` 受浏览器强力节流影响；游戏小窗在主窗口最大化遮挡时仍被 OS 判定为 Occluded 降为 0 FPS | 后台长文/游戏回复偶发假死 |
| **P2** | **P2-5** | `controller.ts` & `providers.ts` | 千问/文心/MiniMax 不支持图片附件，但混选发送时不拦截、不预检，直接导致对应模型报错中断 | 多模型发送附件体验挫败 |
| **P3** | **P3-1** | `sidepanel/controller.ts` | 迷雾议会局内 UI 缺失模型头像、专属气泡色、Markdown 渲染与复制按钮，且剧本弹窗标题重复（「剧本 剧本」） | 迷雾议会视觉完成度明显低于狼人杀 |
| **P3** | **P3-2** | `sidepanel/controller.ts` | 专家团默认预设为空（冷启动无模板），且专家配置入口分散在两个不同抽屉弹窗中 | 新用户上手专家团链路繁琐 |
| **P3** | **P3-3** | `sidepanel/controller.ts` | 轮数滑块 `input` 事件未防抖高频写 Storage，以及 `controller.ts` 残留 190 行已废弃的前台串行调度代码 | 拖动滑块卡顿、代码冗余维护难 |
| **P3** | **P3-4** | `background.ts` / `common.ts` | 异常中断或超时的会话在 `chrome.storage.local` 残留大量孤儿 Key（`Baseline` / `Journal` / `Terminal`） | 本地存储垃圾堆积 |
| **P4** | **P4-1** | 新增功能 | **新增「一键总结 / 主持收敛官（Moderator）」功能**（在对话/圆桌/专家团结束后指定模型汇总共识与分歧） | 极大提升多 AI 对比与讨论的实用闭环 |
| **P4** | **P4-2** | 新增功能 | **新增单模型「重试 (Retry)」与「跳过本轮 (Skip)」按钮**（防止单个平台验证码/断连卡死整场圆桌） | 容错韧性大幅提升 |
| **P4** | **P4-3** | 新增功能 | **新增「分栏对比视图（全屏模式）」与深色模式（Dark Mode）自适应** | 充分利用「全屏打开」的大屏空间 |

---

### 5.2 P1 级（致命/阻塞级）详细整改方案

#### 【P1-1】修复完成判定逻辑与后台保活脉冲（见前文 2.3 节方案 A & B）
* **涉及文件**：`src/content/common.ts`、`src/content/page-liveness.ts`、`src/background.ts`
* **执行动作**：
  1. 在 `src/content/common.ts` 的 `responseCompletionReady()` 中移除 `replyAccelerationEnabled &&` 的错误前置条件，使关闭前台切页加速时依然能通过 `observedGenerationComplete` 在 2.5 秒内完成回复确认。
  2. 将 `explicitComplete` 静默阈值设为 `1500ms`，`observedGenerationComplete` 静默阈值设为 `2500ms`，避免思考模型在「思考结束 -> 正文开始」切换瞬间被 1 秒静默误判截断。
  3. 将 `src/background.ts` 第 377 行 `acceleratePendingReplies` 的定时器间隔从 `4000ms` 调整为 `2000ms`，并在 `page-liveness.ts` 的 `check()` 中执行 4 次间隔 40ms 的连续帧脉冲。

#### 【P1-2】消除流式输出期间的 `chrome.storage.local` 写放大风暴 + 剥离附件 Base64 + 补充 `unlimitedStorage` 权限
* **涉及文件**：`manifest.json`、`src/background/orchestrator.ts`、`src/sidepanel/controller.ts`
* **问题根因**：
  1. `manifest.json` 的 `permissions` 缺少 `"unlimitedStorage"`，导致默认只有 10MB 配额。
  2. `PROVIDER_RESPONSE_DELTA` 每秒触发数十次，每次都调用 `mutatePersistedState` 读写整个 `chrome.storage.local`，并触发 `chrome.storage.onChanged` 导致侧边栏全量 `messagesEl.replaceChildren()` 重建 DOM。
* **具体可执行代码方案**：

  **步骤 1：在 `manifest.json` 中添加 `"unlimitedStorage"` 权限：**
  ```json
  "permissions": [
    "sidePanel",
    "tabs",
    "tabGroups",
    "storage",
    "unlimitedStorage",
    "scripting",
    "alarms"
  ]
  ```

  **步骤 2：在 `src/background/orchestrator.ts` 中对 `PROVIDER_RESPONSE_DELTA` 进行内存合并与节流落盘（每 1.2 秒写一次盘，但实时向侧边栏广播轻量级 `STREAM_DELTA` 消息）：**
  ```typescript
  // src/background/orchestrator.ts 新增流式节流缓冲池
  const lastDeltaPersistAt = new Map<string, number>();

  // 在 handleProviderEvent 中优化 PROVIDER_RESPONSE_DELTA 分支：
  if (event.type === 'PROVIDER_RESPONSE_DELTA' && event.operationId) {
    const now = Date.now();
    const lastPersist = lastDeltaPersistAt.get(event.operationId) ?? 0;
    // 实时发送轻量级流式事件给 SidePanel 局部更新 DOM，不触发全量 Storage 重载
    chrome.runtime.sendMessage({
      source: 'background',
      type: 'STREAM_DELTA',
      operationId: event.operationId,
      provider: event.provider,
      text: event.text ?? ''
    }).catch(() => undefined);

    // 仅每隔 1500ms 才持久化一次 Storage，减少 90% 以上的磁盘序列化开销
    if (now - lastPersist < 1500) return;
    lastDeltaPersistAt.set(event.operationId, now);
  }
  if (event.type === 'PROVIDER_RESPONSE_COMPLETED' || event.type === 'PROVIDER_ERROR') {
    if (event.operationId) lastDeltaPersistAt.delete(event.operationId);
  }
  ```

  **步骤 3：在 `src/sidepanel/controller.ts` 中监听 `STREAM_DELTA` 实现单气泡局部增量更新（不销毁整个消息列表 DOM、不强制抢占滚动条）：**
  ```typescript
  // src/sidepanel/controller.ts 中为每个气泡增加 data-message-id 属性，并增量更新：
  function updateStreamingBubbleInPlace(messageId: string, text: string): boolean {
    const row = messagesEl.querySelector<HTMLElement>(`[data-message-id="${messageId}"]`);
    const bubble = row?.querySelector<HTMLElement>('.message-bubble');
    if (!row || !bubble) return false;
    const isNearBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 80;
    bubble.innerHTML = renderMarkdown(text || '…');
    decorateRenderedMarkdown(bubble);
    const statusEl = row.querySelector<HTMLElement>('.message-status');
    if (statusEl) statusEl.textContent = '生成中';
    if (isNearBottom) {
      requestAnimationFrame(() => { messagesEl.scrollTop = messagesEl.scrollHeight; });
    }
    return true;
  }
  ```

#### 【P1-3】为「AI 迷雾议会」增加宽松正则提取、单次 `[FORMAT REPAIR]` 自动重试与安全恢复机制
* **涉及文件**：`src/game/fog-council/actions.ts`、`src/background/fog-council-engine.ts`
* **问题根因**：`parseCouncilFinalAnswer` 使用了全字符串锚定匹配 `/^\[\[COUNCIL:VOTE:([ABC])\]\]$/`，且 `fog-council-engine.ts` 没有重试机制，报错后直接锁死对局。
* **具体可执行代码方案**：

  **步骤 1：升级 `src/game/fog-council/actions.ts` 支持容错提取（兼容尾随标点、代码块及自然语言兜底）：**
  ```typescript
  // src/game/fog-council/actions.ts 替换 parseCouncilFinalAnswer
  import { COUNCIL_CHANNELS } from './core';
  import type { CouncilChannel } from './types';

  export type CouncilMachineAction =
    | { type: 'vote'; channel: CouncilChannel }
    | { type: 'speech'; text: string };

  const VOTE_TAG_RE = /\[\[COUNCIL\s*:\s*VOTE\s*:\s*([ABC])\s*\]\]/gi;
  const BARE_VOTE_RE = /(?:^|\n)\s*(?:我(?:最终)?选择|密封(?:表决|投票)(?:选择)?|投票(?:给)?|频道)\s*[:：]?\s*([ABC])\s*(?:频道)?[。！!]?\s*$/i;
  const SPEECH_TAG_RE = /\[\[COUNCIL\s*:\s*SPEAK\s*\]\]/gi;

  export function parseCouncilFinalAnswer(text: string, stage: 'debate' | 'ballot'): CouncilMachineAction {
    const trimmed = text.trim();
    if (stage === 'ballot') {
      const matches = [...trimmed.matchAll(VOTE_TAG_RE)];
      const lastMatch = matches.at(-1);
      const fallback = lastMatch ? undefined : trimmed.match(BARE_VOTE_RE);
      const channel = (lastMatch?.[1] ?? fallback?.[1])?.toUpperCase() as CouncilChannel | undefined;
      if (!channel || !COUNCIL_CHANNELS.includes(channel)) {
        throw new Error('未检测到合法的密封表决标记 [[COUNCIL:VOTE:A/B/C]]');
      }
      return { type: 'vote', channel };
    }
    // 辩论发言阶段：提取并剥离 [[COUNCIL:SPEAK]]，若模型漏写标记但正文合理（10~1500字），自动容错放行
    const prose = trimmed.replace(SPEECH_TAG_RE, '').trim();
    if (!prose) throw new Error('发言内容不能为空');
    const safeProse = prose.length > 1500 ? `${prose.slice(0, 1497)}...` : prose;
    return { type: 'speech', text: safeProse };
  }
  ```

  **步骤 2：在 `src/background/fog-council-engine.ts` 中支持格式修复重试与暂停后安全重派发：**
  在 `FogCouncilPendingTurn` 中加入 `retryCount?: number`，当 `parseCouncilFinalAnswer` 在 `ballot` 阶段失败且 `retryCount < 1` 时，自动追加 `[FORMAT REPAIR] 请仅输出 [[COUNCIL:VOTE:A]]、[[COUNCIL:VOTE:B]] 或 [[COUNCIL:VOTE:C]]` 重试一次；并在 `resumeGame()` 中清理已失败的 `pendingTurn` 重新驱动当前议席，而不是直接抛错逼用户开新局。

#### 【P1-4】为「AI 对话 (QA)」模式补齐「中断」按钮，解除删除/新建会话死锁
* **涉及文件**：`src/sidepanel/controller.ts`、`src/background/orchestrator.ts`、`src/background.ts`
* **问题根因**：QA 模式下没有中断入口，一旦某个 Provider 卡在 `pendingOperations` 中，用户点击「新会话」或删除会话都会被 `请先中断正在运行的会话` 拦截，陷入死锁。
* **具体可执行代码方案**：
  1. 在 `src/background/orchestrator.ts` 中扩展 `interruptSequential(sessionId)` 为通用的 `interruptSession(sessionId)`，遍历 `Object.values(session.pendingOperations ?? {})`，将所有未完成消息置为 `'interrupted'`，清空 `session.pendingOperations`，并并行调用 `bridge.cancel(op.provider, op.operationId, tabId)`。
  2. 在 `src/sidepanel/controller.ts` 的 `renderMode()` / `renderMessages()` 中检测当前 QA 会话是否存在 `Object.keys(session.pendingOperations ?? {}).length > 0`：
     * 若存在正在运行的 QA 请求，将 `qaSendButton` 文字切换为 `中断` 并加上 `.danger` 样式，点击时调用 `runtimeMessage({ type: 'INTERRUPT_SESSION', sessionId: session.id })`！

---

### 5.3 P2 级（重要功能缺陷与交互逻辑）详细整改方案

#### 【P2-1】重构顶栏 5 个模式图标间距与响应式布局（完整代码见第 3.2 节）
* **涉及文件**：`src/sidepanel/index.html`、`src/sidepanel/styles.css`、`SVG/迷雾议会.svg`
* **核心改动**：移除 `.mode-tabs` 的 `position: absolute`，将未激活按钮宽度从 `44px` 缩至 `28px`（消除 `31px` 过大空白），激活态显示短文字标签（对话/圆桌/专家团/狼人杀/议会），并重绘 `迷雾议会.svg` 为统一的 20×20 线性图标。

#### 【P2-2】重构圆桌与专家团的串行 Prompt 构造器（加入轮次感知、阵容感知、尾轮收敛与重连人设恢复）
* **涉及文件**：`src/background/orchestrator.ts`
* **具体可执行代码方案（替换 `buildSequentialPrompt` 与 `withExpertPreset`）**：
```typescript
// src/background/orchestrator.ts 升级版圆桌/专家团 Prompt 构造器
function buildSequentialPrompt(session: ConversationSession, provider: ProviderId): string {
  const execution = session.execution;
  const roundNum = (execution?.roundIndex ?? 0) + 1;
  const totalRounds = execution?.targetRounds ?? session.rounds ?? 1;
  const isFinalRound = roundNum >= totalRounds;
  const roster = (execution?.providers ?? [])
    .map((p, idx) => `${idx + 1}. ${expertDisplayLabel(session, p)}${p === provider ? '（你）' : ''}`)
    .join('、');

  let lastOwnIndex = -1;
  session.messages.forEach((message, index) => {
    if (message.role === 'assistant' && message.provider === provider && message.status === 'completed') {
      lastOwnIndex = index;
    }
  });

  const unseen = session.messages
    .slice(lastOwnIndex + 1)
    .filter((message) => message.role === 'user' || (message.role === 'assistant' && message.provider !== provider && message.status === 'completed'));

  const header = `【圆桌议程】当前第 ${roundNum}/${totalRounds} 轮 · 参与者：${roster}`;
  const body = unseen.length
    ? unseen.map((message) => `【${message.role === 'user' ? '用户议题' : expertDisplayLabel(session, message.provider)}】\n${message.text}`).join('\n\n')
    : '请基于当前议题继续深入讨论，补充新的视角或具体方案。';

  // 区分「首轮第一位发言」「中间轮次接力」与「最后一轮收敛」三种引导语
  let instruction: string;
  if (lastOwnIndex === -1 && unseen.every((m) => m.role === 'user')) {
    instruction = '你是本场讨论的第一位发言者。请直接针对【用户议题】给出结构清晰、有深度的首轮观点，为后续参与者奠定讨论基础。';
  } else if (isFinalRound) {
    instruction = '现在是最后一轮收官发言。请直接回应前序参与者的核心分歧，整合各方洞见并给出明确、可落地的最终结论，不要再抛出开放式反问。';
  } else {
    instruction = '请基于以上新增发言继续推进讨论：直接指出你赞同或质疑的具体观点，补充增量信息或反例，避免重复他人已述内容。';
  }

  return `${header}\n\n${body}\n\n${instruction}`;
}
```
同时，在 `ensureBindings()` 中，当某个 `provider` 触发了 `createFreshConversation`（即新建或重置了网页会话）时，自动从 `session.expertInitializedProviders` 中移除该 `provider`，确保新网页能重新收到专家身份 Prompt 与完整上下文！

#### 【P2-3】修复狼人杀的三大引擎缺陷（女巫毒药目标误导、删除对局标签页泄漏、人类投票串行阻塞）
* **涉及文件**：`src/game/werewolf/context.ts`、`src/background/werewolf-engine.ts`、`src/background.ts`
* **具体可执行代码方案**：
  1. **修复女巫 Prompt 毒药目标列表（`src/game/werewolf/context.ts` 第 82 行）**：
     ```typescript
     const poisonTargets = allowedTargets.filter((target) => target !== seat);
     const poisonRule = expectedActions.includes('poison') && poisonTargets.length
       ? `POISON 合法目标：${poisonTargets.join('、')}（女巫不能毒自己）。`
       : '';
     ```
  2. **修复删除狼人杀对局时的标签页泄漏（`src/background/werewolf-engine.ts` `deleteGame`）**：
     与 `fog-council-engine.ts` 保持一致，在 `WerewolfProviderBridge` 中注入 `closeTab: (tabId: number) => Promise<void>`，并在 `deleteGame(gameId)` 中关闭 `Object.values(game.bindings)` 下的所有私密游戏标签页。
  3. **让人类玩家在白天投票阶段无需等待前序 AI（`src/background/werewolf-engine.ts` `day_vote` / `day_tiebreak_vote`）**：
     进入 `day_vote` 时，先检查存活的 `human` 玩家是否尚未投票且 `!game.pendingHumanAction`；若是，则直接生成 `game.pendingHumanAction`（不阻塞 AI 队列），同时继续派发首个未投票的 AI 玩家。这样人类玩家在进入投票阶段的第 1 秒就能看到投票面板并点击提交！

#### 【P2-4】优化私密游戏窗口防遮挡机制（`src/background/private-game-pages.ts`）
* **涉及文件**：`src/background/private-game-pages.ts`
* **具体建议**：
  在 `wakeWindow` 中，除设置窗口位置外，针对后台游戏标签页在 `content/page-liveness.ts` 中启用轻量静音 `AudioContext` 振荡器（增益 `gain = 0.00001`，仅在游戏 `pendingTurn` 活跃期间开启，回合结束立即 `close()`）或使用 Web Worker 定时脉冲发送 `CustomEvent`。在 Chromium 内核中，持有活跃 Web Audio 图或 WebLock + 端口高频脉冲的标签页可豁免 `CalculateNativeWinOcclusion` 导致的渲染管线完全挂起。

#### 【P2-5】发送带图片/附件消息前，预检 Provider 附件能力并友好提示或自动跳过
* **涉及文件**：`src/sidepanel/controller.ts`
* **问题根因**：`PROVIDERS` 中 `qwen`、`wenxin`、`minimax` 的 `capabilities.images` 和 `capabilities.attachments` 均为 `false`，但用户在发送带图消息时系统未做任何前置校验。
* **具体可执行代码方案**：
  在 `handleQaSend()` 与 `handleSequentialAction()` 中加入前置校验：
  ```typescript
  if (payload.attachments.length > 0) {
    const unsupported = providers.filter((p) => {
      const cap = providerById[p]?.capabilities;
      return payload.attachments.some((att) => att.kind === 'image' ? !cap?.images : !cap?.attachments);
    });
    if (unsupported.length > 0) {
      const names = unsupported.map((p) => providerById[p].label).join('、');
      if (unsupported.length === providers.length) {
        return showComposerError(`当前所选模型（${names}）暂不支持网页端自动上传图片/附件，请更换模型或仅发送文字`);
      }
      showComposerError(`提示：${names} 暂不支持自动上传附件，本次将仅向其发送文字内容`);
    }
  }
  ```
  并在 `orchestrator.ts` 的 `dispatchOperation` 中，若目标 `provider` 不支持附件，自动将发往该 `provider` 的 `payload.attachments` 置为 `[]`（仅发文字），避免直接抛错中断整场圆桌！

---

### 5.4 P3 级（体验、UI 与代码质量改进）详细整改方案

#### 【P3-1】补齐「AI 迷雾议会」局内视觉体验，对齐狼人杀 UI 标准并修复文案笔误
* **涉及文件**：`src/sidepanel/index.html`、`src/sidepanel/controller.ts`
* **具体整改项**：
  1. 修复 `src/sidepanel/index.html` 第 77 行标题重复笔误：将 `<h2 id="fogCouncilScriptTitle">原创信号剧本 剧本</h2>` 改为 `<h2 id="fogCouncilScriptTitle">迷雾议会 · 身份与信号说明</h2>`。
  2. 修复 `src/sidepanel/styles.css` 与 `index.html` 的类名拼写不一致：
     **【隐藏 CSS 失效 Bug】**！请看 `src/sidepanel/index.html` 第 52 行写的是 `class="fogCouncil-controls hidden"`（驼峰命名），第 62 行写的是 `class="fogCouncil-setup-fields"` 和 `class="fogCouncil-human-toggle"`，第 77 行写的是 `class="drawer-panel fogCouncil-script-panel"`；而 `src/sidepanel/styles.css` 第 207、215、248 行定义的却是连字符命名 `.fog-council-controls`、`.fog-council-setup-fields`、`.fog-council-human-toggle`、`.fog-council-script-body`！**由于 HTML 用了驼峰 `fogCouncil-*` 而 CSS 用了短横线 `fog-council-*`，导致迷雾议会的底部控制栏网格布局、设置页两列网格布局、剧本弹窗间距样式全部失效**！
     * **修复方法**：将 `src/sidepanel/index.html` 中的 `fogCouncil-controls`、`fogCouncil-setup-fields`、`fogCouncil-human-toggle`、`fogCouncil-script-panel`、`fogCouncil-script-body` 全部统一替换为 `fog-council-*` 短横线命名！
  3. 在 `renderFogCouncilGame()`（`src/sidepanel/controller.ts` 第 525–563 行）中：
     * 为议席卡片添加 AI 模型的头像 `<img src="${providerIconUrl(provider)}">`；
     * 为发言事件行添加对应模型的气泡颜色类 `providerById[provider].colorClass`；
     * 将 `text.textContent = item.text` 升级为 `text.innerHTML = renderMarkdown(item.text); decorateRenderedMarkdown(text);` 并附上 `createReplyActions(item.text)` 复制按钮。

#### 【P3-2】内置精选专家团预设库 + 优化专家团配置直达入口
* **涉及文件**：`src/shared/storage.ts`、`src/sidepanel/controller.ts`
* **具体整改项**：
  1. 在 `src/shared/storage.ts` 的 `DEFAULT_STATE.expertPresets` 中预置 6 个高质量开箱即用专家角色：
     * **产品总监 (PM)**：从用户价值、商业闭环、MVP 边界与需求优先级审视方案；
     * **系统架构师 (Architect)**：从技术选型、可扩展性、高可用、性能瓶颈与实现成本评估；
     * **魔鬼代言人 / 红队批判者 (Red Team)**：专找逻辑漏洞、极端边界情况、合规风险与失败可能；
     * **增长与运营专家 (Growth)**：聚焦冷启动获客、转化漏斗、留存机制与传播裂变；
     * **用户体验设计师 (UX/UI)**：关注交互直觉、认知负荷、视觉层级与情绪价值；
     * **第一性原理思考者 (First Principles)**：剥离表象假设，追问本质问题与底层逻辑。
  2. 当用户切换到「专家团」模式的空白会话页（`.empty-state`）时，直接在空白卡片下方渲染当前已选模型的专家分配快捷下拉框与「管理专家预设」按钮，无需让用户再去顶栏点两个抽屉菜单。

#### 【P3-3】为轮数滑块增加防抖（Debounce）并清理 `controller.ts` 中的废弃死代码
* **涉及文件**：`src/sidepanel/controller.ts`
* **具体整改项**：
  1. `roundRange.addEventListener('input', ...)` 改为在 `input` 事件中仅更新本地 DOM 数字显示（`roundNumber.value = roundRange.value`），而在 `change` 事件（松手时）才调用 `void saveState(state)`，避免拖动滑块时触发几十次跨进程 Storage 同步。
  2. 删除 `src/sidepanel/controller.ts` 中已不再使用的 `waitForProvider`、`onProviderEvent`、`ensureSessionBindings`、`runSequential`、`interruptSequential` 及相关全局变量，净减约 190 行冗余代码。

#### 【P3-4】定期清理 `chrome.storage.local` 中的孤儿操作日志 Key
* **涉及文件**：`src/background.ts`
* **具体整改项**：
  在 `checkPendingProviders()` 或 `orchestrator.recover()` 中，扫描 `chrome.storage.local` 中所有以 `multiAiRoundtableTerminal:`、`multiAiRoundtableResponseBaseline:`、`multiAiRoundtableDoubao:`、`multiAiRoundtableKimi:`、`multiAiRoundtableWenxin:`、`multiAiRoundtableMinimax:` 开头的 Key，若其 `operationId` 已不在任何活跃会话或游戏的 `pendingOperations` / `pendingTurn` 中，立即批量调用 `chrome.storage.local.remove(orphanKeys)` 清理。

---

### 5.5 P4 级（高价值新增功能与架构演进建议）

#### 【P4-1】新增「一键总结 / 圆桌裁判收敛官（Synthesize & Verdict）」功能
* **痛点场景**：用户在「AI 对话」向 5 个模型提问，或在「AI 圆桌 / 专家团」进行了 3 轮激烈辩论后，面对上万字的回答，最核心的需求是**「把共识、分歧和最终可执行建议提炼出来」**。
* **实现方案**：
  1. 在会话已有至少 2 条已完成 AI 回复且当前处于非运行状态时，在输入框上方操作栏显示一个轻量按钮 **`✨ 汇总结论`**（旁附下拉框可指定由哪个模型担任总结官，默认取当前列表第一个可用模型如 DeepSeek 或 GPT）。
  2. 点击后构造结构化总结 Prompt：
     ```text
     你现在担任本场多 AI 讨论的「首席总结官」。请基于以下各模型的发言内容，输出一份结构化决议报告：
     1. 【核心共识】：所有模型一致认同的结论或方案要点；
     2. 【关键分歧与优劣对比】：各模型存在冲突的观点及各自适用前提（建议使用表格）；
     3. 【最终落地建议】：综合各方优势后的最佳执行路径。
     ```
  3. 调用 `dispatchOperation` 发送给指定总结官模型，并将返回的消息标记为特殊样式（如带「📋 总结官」徽章的置顶/尾随总结卡片）。

#### 【P4-2】新增异常气泡上的「单模型重试 (Retry)」与「跳过该模型继续 (Skip)」按钮
* **痛点场景**：网页端 AI 偶尔会遇到 Cloudflare 验证码、登录过期或网络抖动导致单个模型报错，此时圆桌会议被迫暂停。如果用户不想去网页端处理该模型，目前无法直接跳过它继续让后面的模型发言。
* **实现方案**：
  1. 在 `src/background/orchestrator.ts` 中新增 `skipCurrentSequentialTurn(sessionId)` 与 `retryMessage(sessionId, messageId)` 接口。
  2. 当消息状态为 `status === 'error'` 或 `status === 'interrupted'` 时，在消息气泡下方渲染 **`[重试]`** 与 **`[跳过并继续]`** 两个迷你按钮：
     * 点击「重试」：复用该 `provider` 重新派发当前回合；
     * 点击「跳过并继续」：将 `execution.providerIndex += 1`（若到队尾则 `roundIndex += 1`），立即唤醒下一位 AI 模型继续圆桌讨论！

#### 【P4-3】强化「全屏模式（`?standalone=1`）」为多列看板视图 + 支持深色模式（Dark Mode）
* **痛点场景**：顶栏左侧已经做了一个「全屏打开」按钮（打开 `sidepanel/index.html?standalone=1`），但打开后只是把原本 360px 的单列窄侧边栏拉伸成超宽单列气泡，大屏空间利用率极低。
* **实现方案**：
  1. 在 `styles.css` 中检测 `@media (min-width: 900px)`：
     * 在「AI 对话（QA）」模式下，自动将同一轮的多个 AI 回复由「纵向单列堆叠」切换为 **`grid-template-columns: repeat(auto-fit, minmax(340px, 1fr))` 多列并排对比卡片**，让用户在大屏下一目了然横向对比 GPT、DeepSeek、Claude/Gemini 的回答！
     * 在「狼人杀 / 迷雾议会」模式下，大屏自动采用左栏「座位态势盘 + 计分板」、右栏「发言时间线」的双栏布局。
  2. 在 `:root` 中增加 `@media (prefers-color-scheme: dark)` 深色主题变量，并将 5 个模式 SVG 图标的 `fill="#1D1D1D"` 改为通过 CSS `filter` 或内联 `currentColor` 适配深色背景。

---

## 六、 优先落地执行路线图（Actionable Checklist）

为了以最小改动成本获得最大稳定性与体验提升，建议按以下三个阶段推进代码修改：

1. **第一阶段（半天内可完成，解决最痛的卡顿、样式失效与布局问题）**：
   - [ ] 修复 `src/sidepanel/index.html` 中 `fogCouncil-*` 与 `styles.css` 中 `fog-council-*` 的类名不一致 Bug 及「剧本 剧本」文字重复；
   - [ ] 应用本文 **3.2 节** 的顶栏 `.mode-tabs` 紧凑胶囊 + 激活态文字标签 CSS/HTML 方案，替换 `迷雾议会.svg`；
   - [ ] 修复 `src/content/common.ts` 中 `responseCompletionReady()` 的 `replyAccelerationEnabled` 错误耦合，消除关闭回复加速后的 12–20 秒延迟；
   - [ ] 在 `manifest.json` 中补上 `"unlimitedStorage"` 权限。
2. **第二阶段（1 天内可完成，解决死锁、死局与流式性能问题）**：
   - [ ] 应用本文 **5.2 节【P1-3】** 升级 `fog-council/actions.ts` 的容错解析与重试恢复；
   - [ ] 应用本文 **5.2 节【P1-4】** 为「AI 对话」模式补齐「中断」按钮；
   - [ ] 应用本文 **5.2 节【P1-2】** 对流式 `PROVIDER_RESPONSE_DELTA` 进行节流落盘与局部 DOM 更新；
   - [ ] 修复狼人杀 `deleteGame` 未关闭私密标签页的内存泄漏及女巫首夜毒药 Prompt 目标列表 Bug。
3. **第三阶段（1–2 天内完成，大幅拔高产品力）**：
   - [ ] 升级圆桌与专家团的议程感知 Prompt（含首轮语病修正与尾轮收敛指令）并内置 6 个默认专家模板；
   - [ ] 上线「✨ 一键汇总结论」与错误气泡「跳过 / 重试」按钮；
   - [ ] 为全屏模式（`?standalone=1`）启用宽屏多列并排对比布局。
