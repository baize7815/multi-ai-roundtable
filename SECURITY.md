# Security Policy / 安全说明

## Reporting a vulnerability / 漏洞报告

Please do not disclose access tokens, cookies, session files, personal
conversation content, or browser profiles in public issues.

Report security-sensitive issues privately using GitHub's repository
security advisory feature when available. Never attach raw browser
storage, HAR traces, cookies, or logged-in AI page screenshots.

## Privacy model / 隐私边界

Multi AI Roundtable operates through AI websites to which the user
has independently logged in. Providers receive the prompts and context
that the user explicitly sends through the extension; normal provider
privacy policies and account rules apply.

The extension must not publish, export, or upload Chrome profiles,
authentication cookies, stored conversations, or private role data as
part of a release. Game agents receive only the context allowed by
their seat/role. Intermediate reasoning is not displayed in game chat.

No security or anti-cheat guarantee is made against the owner of the
browser or a compromised browser profile.

## Release hygiene / 发布安全

- Use a clean demonstration profile and fictional game conversations for screenshots.
- Run credential and secret scanning on the *entire staged set*, including dist/.
- Review compiled JavaScript, source maps, and third-party images.
- Never commit node_modules/, browser profiles, session logs or .env files.
- Keep tests for three existing chat modes and both game engines green.
