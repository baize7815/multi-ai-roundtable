# Multi AI Roundtable

> **Ten AI websites. One multi-agent workspace.**

Use your signed-in AI websites for parallel answers, sequential discussions, expert collaboration and AI social-deduction games. No separate vendor API keys are required.

**Author:** [@baize7815](https://github.com/baize7815) · Chrome MV3 · TypeScript · Free, non-commercial community project · [中文](README.md)

> **Public release v0.2.0**: Five integrated modes including the original AI Fog Council game.

## Highlights

- Ten web AI integrations: Doubao, DeepSeek, Kimi, Qwen, Zhipu, ChatGPT, Gemini, Grok, Wenxin and MiniMax.
- AI Chat: compare concurrent responses from multiple providers.
- AI Roundtable: strict sequential relay and multiple discussion rounds.
- Expert Team: private per-provider role presets for cooperative analysis.
- AI Werewolf: hidden-role gameplay with deterministic state-machine adjudication.
- AI Fog Council: an original signal-inference game with sealed ballots, public debate and faction scoring.
- Session recovery, interruption/resumption, separate per-provider conversations and final-only game response commits.

## Modes

| Mode | Workflow |
| --- | --- |
| AI Chat | Concurrent messages and comparisons |
| AI Roundtable | Sequential, multi-round relay |
| Expert Team | Role-based multi-agent collaboration |
| AI Werewolf | Private roles, night actions, public discussion and voting |
| AI Fog Council | Original 6–8 player hidden-signal inference and team scoring |

## Screenshots

Seven genuine extension screenshots are available in the [Chinese README gallery](README.md#先看效果), including AI Chat, Roundtable, Expert Team, Werewolf, settings and history. See [screenshot guidelines](docs/SCREENSHOTS.md).

## Install

Download the official release ZIP from GitHub Releases: extract the archive, open Chrome's `chrome://extensions/`, enable Developer mode, then **Load unpacked** and select the `dist/` directory.

Build with Node.js 22+:

```bash
npm ci
npm run typecheck
npm run test:werewolf
npm run test:clocktower
npm run build
```

## Architecture

```text
Chrome Side Panel → MV3 Service Worker
    → Session Orchestrator / Game Engines
    → Managed Tabs & Provider Content Scripts
    → Signed-in AI websites
```

The extension is not affiliated with any AI vendor. Web integration depends on provider page structures, login state and terms. No API key requirement does **not** mean that submitted prompts stay on your device.

## Privacy, third-party rights and attribution

Do not include account cookies, tokens, Chrome browser profiles, real private conversations or hidden game state in published screenshots, issues or artifacts. See [SECURITY.md](SECURITY.md).

AI Fog Council is an original game system. A former local third-party-script experiment is intentionally excluded from the public source and compiled distribution. See [release checklist](docs/RELEASE_CHECKLIST.md).

Original work © 2026 [@baize7815](https://github.com/baize7815). Original project code is licensed under [Apache-2.0](LICENSE), with required copyright, modification and attribution notices. Contribute through [CONTRIBUTING.md](CONTRIBUTING.md).
