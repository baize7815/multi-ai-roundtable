# 七牛云专家预设备份

在「预设管理 → 七牛云备份（自行配置）」输入自己的七牛 S3 存储桶 HTTPS 地址、AccessKey、SecretKey。固定对象路径：`multi-ai-roundtable/experts.json`，不会覆盖 PromptSave 的 `promptsave/backup.zip`。

- 上传云端：手动上传整个预设库，覆盖前确认。
- 下载并合并：按预设名称匹配，同名更新，不同名新增。
- 下载并替换：确认后以云端清单覆盖本地预设，同名预设保留原 ID，其余绑定自动清理。
- 顶部四个按钮：云上传、云下载并合并、本地导入、本地导出。

端点格式是 `https://bucket.s3.region.qiniucs.com`；要求 HTTPS，不能使用 CDN 或任意第三方域名。上传和下载的 JSON 最大为 5 MiB，使用 AWS SigV4 签名。

存储桶请设置为私有。地址及 AccessKey 保存在 chrome.storage.local；SecretKey 仅保存在 chrome.storage.session，浏览器退出后需要重新填写。浏览器环境无法安全保管长期凭证，对公开分发的应用，推荐服务端短期凭证。备份数据没有额外的端到端加密。

这是**手动备份**，不支持自动同步。当前已通过离线签名、模拟网络、导入语义与回归测试；**未访问真实七牛存储桶**，实际上线前需自行测试 S3 API 权限和网络环境。本功能包含在 v0.2.3 发行版中；真实七牛存储桶的读写仍需用户在自己的环境中验证。
