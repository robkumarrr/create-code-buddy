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

## 📁 What lives where

Everything is sourced from one folder. The two subfolders differ in *how* they reach
an agent, not in how important they are:

```
.codebuddy/
├── config.json
├── rules/      → copied into every agent's rules folder
│   ├── conventions.md
│   └── backend/database.md      (nest however you like)
└── specs/      → stays put; agents are pointed at it, not given a copy
    └── mcp-server.md
```

**Rules** are standing guidance — "always do this", or "do this when touching these
files." They're small and they're compiled everywhere.

**Specs** are what you're building and where it stands. They're listed by path and
`status:` in `AGENTS.md` so an agent can open the one that matters, rather than
carrying every spec you've ever written in context on every turn.

Write a spec by hand as `.codebuddy/specs/<name>.md` — there's no command for it yet —
with `description:` and `status:` frontmatter, then run `sync`:

```markdown
---
description: Expose Code Buddy operations as an MCP server
status: backlog
---
```

`status:` is one of `backlog`, `in-progress`, `in-review` or `done` — the columns most
ticket boards use. Anything else still
renders, so nothing breaks if you go off-script, but sticking to these keeps the index
readable when several specs are live at once.

Only `rules/` and `specs/` are recognized. A folder name is a promise about where its
contents go, and the tool can only keep that promise for the two it knows how to
place — anything else gets a warning rather than being skipped in silence.

## 🧠 Supported Agents
We natively compile your markdown rules into the exact format required by:

- **Cursor** (`.cursor/rules/*.mdc`)
- **Claude Code** (`.claude/rules/*.md`) — `paths:` block-list scoping, always-on rules carry no frontmatter
- **Cline** (`.clinerules/*.md`) — same `paths:` format as Claude Code above
- **GitHub Copilot** (`.github/instructions/*.instructions.md`)
- **Gemini** (`.agents/rules/*.md`) — also restores this tool's own system rule as a native Gemini Skill
- **Windsurf** (`.windsurf/rules/*.md`) — see note below; Windsurf rebranded to Devin Desktop

### `AGENTS.md` — everything else

Beyond the adapters above, we write a short **rule index** into your repo's `AGENTS.md`
— the cross-agent convention read natively by **Codex**, Cursor, Copilot, Gemini CLI,
Aider, Devin Desktop, Zed and 20+ others.

It's a pointer, not a copy: each rule's path, description and scope, one line each. The
rule text stays in `.codebuddy/rules/` and the agent opens only what's relevant, instead of
every rule riding along in context on every turn. Only the block between the
`create-code-buddy` markers is ever rewritten — anything you wrote around it is left
alone. Opt out with `--no-agents-md`.

> **Using Claude Code?** It reads `CLAUDE.md`, not `AGENTS.md`, so we maintain a block
> there too — nothing to set up. Select the `claude` agent and your rules compile to
> `.claude/rules/` with real path scoping, while `CLAUDE.md` carries the spec index,
> which is the part nothing else delivers.
>
> **Don't add `@AGENTS.md` to `CLAUDE.md`.** We used to suggest it; it's wrong if any
> other tool writes to both files. Claude Code inlines an import's entire contents, so
> if something like Laravel Boost has put the same block in each, the import loads it a
> second time. `sync` will warn you if it finds the leftover line.

> **Windsurf → Devin Desktop:** Windsurf's docs now redirect to Devin Desktop's. We
> target `.windsurf/rules/`, which is documented as a supported backward-compatible
> location — not the newer `.devin/rules/` path. If Devin Desktop drops that fallback in
> a future release, this integration will need to move with it.

## 🛠 Core Commands

### `add`
Quickly scaffold a new rule into `.codebuddy/rules/`.
```bash
npx create-code-buddy add
```

### `sync`
Compiles everything in `.codebuddy/rules/` into your active AI agent directories,
formatting frontmatter to match each engine, and refreshes the index in `AGENTS.md`.
Generated files that no longer have a source are removed; anything you wrote by hand
is left alone.
```bash
npx create-code-buddy sync
```

### `list`
Interactive navigator. View all your SSOT rules and instantly open them in your IDE.
```bash
npx create-code-buddy list
```

### `migrate`
For projects created before rules moved into `.codebuddy/rules/`. Moves loose
`.codebuddy/*.md` files into `rules/`, keeping any nesting. Shows you the plan first
and changes nothing until you pass `--apply`; it never runs on its own.
```bash
npx create-code-buddy migrate          # dry run
npx create-code-buddy migrate --apply
```

### `clean`
Safely removes generated rules from your agent folders. Personal (non-generated) rules are strictly preserved.
```bash
npx create-code-buddy clean
```

> **Need a factory reset?** Run `npx create-code-buddy clean --hard` to safely backup your SSOT as a `tar.gz` and wipe all agent integrations cleanly. In a non-interactive shell (a script, a git hook), add `--force` to skip the confirmation prompts — without it, `--hard` fails with a clear message rather than hanging on a prompt nothing will ever answer.

## 🚧 What this doesn't do yet

Being upfront about the edges, since a bug report from someone who believed the docs
costs more than a shorter feature list:

- **No import from existing agent-specific rules.** If you already have `.cursor/rules/`
  or similar, there's no command yet to pull them into `.codebuddy/` for you.
- **No drift detection.** If you commit compiled folders for your team and someone hand-edits
  one, nothing currently warns you before the next `sync` overwrites it.
- **No MCP server.** Rules are compiled to static files; there's no live query interface.
- Windsurf support targets the documented backward-compatible `.windsurf/rules/`
  location, not Devin Desktop's newer `.devin/rules/` — see the note above.

## 🤝 Contributing
Check out our [Contributing Guide](CONTRIBUTING.md) to get started!
