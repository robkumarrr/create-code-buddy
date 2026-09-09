<div align="center">
  <h1>🤖 create-code-buddy</h1>
  <p><strong>The Universal AI Agent Context Manager</strong></p>

  [![npm version](https://img.shields.io/npm/v/create-code-buddy.svg?style=flat-square)](https://www.npmjs.com/package/create-code-buddy)
  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
  [![Build Status](https://img.shields.io/github/actions/workflow/status/robkumarrr/create-code-buddy/ci.yml?style=flat-square)](https://github.com/robkumarrr/create-code-buddy/actions)
</div>

---

Instead of manually editing rules across `.cursorrules`, `.agents`, and `.clinerules`, **create-code-buddy** gives you a Single Source of Truth (SSOT). Write your AI context rules once, and seamlessly compile them across the entire AI agent ecosystem.

## 🚀 Quick Start

Initialize your Code Buddy knowledge base and select your agents:

```bash
npx create-code-buddy init
```

*Don't want the interactive wizard? Run non-interactively:*
```bash
npx create-code-buddy init --yes --agents cursor,cline,gemini
```

## 🧠 Supported Agents
We natively compile your markdown rules into the exact format required by:

- **Cursor** (`.cursor/rules/*.mdc`)
- **Windsurf** (`.windsurf/rules/*.md`)
- **Cline** (`.clinerules/*.md`) — *Includes native `paths:` YAML array conversion and always-on global rule parsing!*
- **Claude Code** (`.claude/rules/*.md`)
- **Gemini** (`.agents/*.md`)
- **GitHub Copilot** (`.github/instructions/*.md`)

## 🛠 Core Commands

### `add`
Quickly scaffold a new rule into your `.codebuddy/` folder.
```bash
npx create-code-buddy add
```

### `sync`
Compiles all rules from your `.codebuddy/` folder into your active AI agent directories. Automatically formats frontmatter to match each specific agent engine.
```bash
npx create-code-buddy sync
```

### `list`
Interactive navigator. View all your SSOT rules and instantly open them in your IDE.
```bash
npx create-code-buddy list
```

### `clean`
Safely removes generated rules from your agent folders. Personal (non-generated) rules are strictly preserved.
```bash
npx create-code-buddy clean
```

> **Need a factory reset?** Run `npx create-code-buddy clean --hard` to safely backup your SSOT as a `tar.gz` and wipe all agent integrations cleanly.

## 🤝 Contributing
Check out our [Contributing Guide](CONTRIBUTING.md) to get started!
