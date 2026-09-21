---
description: Instructions for AI agents on how to manage their own rules
globs: ["*.*"]
---

# Create-Code-Buddy: AI Instructions

Manage rules and specs via the `.codebuddy/` folder. DO NOT edit these compiled directories directly:
- `.claude/rules/`
- `.clinerules/`
- `.cursor/rules/`
- `.agents/rules/`
- `.github/instructions/`
- `.windsurf/rules/`

## Where things live

- `.codebuddy/rules/*.md` — coding rules. These ARE compiled into every agent folder above.
- `.codebuddy/specs/*.md` — feature specs. These are NOT compiled. They are listed with
  their status in AGENTS.md, and in CLAUDE.md for Claude Code; open the one covering what
  you are working on.

- **Create a rule**: Run `npx ccb add --name "folder/rule" --globs "*.ts" --description "..."`
- **Create a spec**: No command for this yet — write `.codebuddy/specs/<name>.md` by hand
  with `description:` and `status:` frontmatter, then sync. `status:` is one of
  `backlog`, `in-progress`, `in-review`, `done`.
- **Edit/Delete**: Modify or delete the `.codebuddy/rules/*.md` files natively.
- **Sync**: ALWAYS run `npx ccb sync` after manual edits to compile changes globally.

## Agent Identity → --agents flag
Pass `--agents` as a comma-separated string (no spaces) matching your runtime:

- `claude`   → Claude Code, Claude.ai (Anthropic)
- `cline`    → Cline (VS Code extension), Continue.dev
- `cursor`   → Cursor IDE, Aider
- `gemini`   → Gemini, Antigravity, Google AI Studio, Gemini CLI
- `copilot`  → GitHub Copilot, VS Code Copilot extension
- `windsurf` → Windsurf, Codeium

Example — Antigravity running non-interactively:
  npx ccb init --yes --agents gemini

Multiple agents (comma-separated, no spaces):
  npx ccb init --yes --agents gemini,cursor
