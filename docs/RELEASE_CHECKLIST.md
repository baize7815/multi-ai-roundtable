# GitHub 公开发布验收记录

项目：Multi AI Roundtable，作者：[@baize7815](https://github.com/baize7815)，发行版本：v0.2.0。

## 公开范围

保留 AI 对话、AI 圆桌、AI 专家团、AI 狼人杀和原创 AI 迷雾议会，随仓库提供 TypeScript 源码、测试、构建脚本及可作为未打包扩展安装的 dist/。此前本地第三方剧本实验实现、测试和素材不在公开目录及构建产物内。本地备份存放于 .gitignore 排除的 tmp/ 目录。

## 开源规则与第三方素材

原创代码采用 Apache-2.0 LICENSE；版权署名 baize7815，按许可证保留版权、LICENSE、NOTICE，并标注修改。所支持 AI 服务的名称和标识属于各自权利人，本扩展不是其官方产品。AI 品牌图形不视为作者原创或被重新授予 Apache 版权。

## 自动验收

- npm run typecheck：TypeScript 严格类型检查
- npm run test:werewolf：原游戏引擎、原对话/圆桌/专家团回归
- npm run test:fog-council：身份与规则、动作隔离、密封投票、6/7/8 人模拟整局、真人参与、幂等和异常恢复
- npm run build：生产打包 dist，关闭 source map
- dist/ 原剧本字符串及旧素材、调试文件检查
- 对真正准备 git add 的源码和 dist 进行敏感数据/个人路径扫描
- 对 GitHub 的 HEAD SHA、公开文件与 Release ZIP 再次核实

## 用户安装

在 GitHub Releases 下载对应版本 ZIP 并解压。打开 chrome://extensions/，开启开发者模式，选择“加载已解压的扩展程序”，选中解压后的 dist 文件夹。项目不提供自动读取 Cookie、Token 或 Chrome Profile 的工具。

## 尚需后续完善

公开截图须经过完整脱敏；本次发布不使用真实个人 AI 账号截图。AI 网站页面可能改版，各模型登录状态与验证码可能影响真实烟测。未来可增加脱敏演示 GIF、更多界面交互测试及更细粒度的恢复提示。
