# v0.2.1 本地经典玩法恢复说明

本地恢复分支：`local/classic-mode-restoration`，**不得直接推送到公开的 main 分支**。

本次修复将原有第五模式的侧栏与完整游戏引擎从 `tmp/prepublish-backup/` 恢复，旧角色内部 ID、执行时序、行动协议、胜负条件、游戏主持人和 AI 网页绑定均保持原有实现。22 个角色仅调整中文显示名称，用户可见的标题统一为“迷雾议会”。

修复身份手册角色卡片的结构与 CSS 不匹配造成的中文字逐字竖排问题：使用原版 `bar + content` 布局，配合完整容器宽度与正常换行，恢复手册关闭按钮绑定。

已通过：`npm run typecheck`、`npm run test:werewolf`、`node scripts/test-clocktower-core.mjs`、`npm run build` 和 UI DOM/CSS 结构检查。

**尚未通过**：`npm run test:clocktower` 的完整游戏引擎自动模拟，该测试超时，不能宣称所有阶段经过完整回归验证。角色手册的实际 Chrome 窗口视觉检查也尚未由用户验收。

此版本仅限本地恢复与验证，版权归属和第三方游戏规则再分发许可与单纯更改名称无关。不对 GitHub 仓库 `baize7815/multi-ai-roundtable` 推送本次恢复代码。
