# Agentic Guidelines for `create-code-buddy`

Welcome, AI Agent! If you are reading this file, you are currently assisting a
contributor with the `create-code-buddy` repository — the CLI itself, not a project
that uses it.

## Project Context

- **Name**: `create-code-buddy` (`ccb` for short)
- **Purpose**: A CLI that centralizes AI agent context in one `.codebuddy/` folder and
  compiles it into the format each target agent actually reads — Cursor, Claude Code,
  Cline, Copilot, Gemini, Windsurf today.
- **Stack**: Node.js, TypeScript, Vitest, Commander.js, `@clack/prompts`, the `yaml`
  package for real frontmatter parsing.
- **Testing**: Real integration tests against temp-dir workspaces, not mocked
  filesystems — see `src/test/workspace.ts`. A coverage gate is enforced
  (`vitest.config.ts`); run `npm test` before committing, and `npm run typecheck` and
  `npm run build` too.

## Active hardening effort

This repo is partway through a hardening pass tracked in
[docs/V1-HARDENING-PLAN.md](docs/V1-HARDENING-PLAN.md). **Read it before changing
anything under `src/`.** It also compiles into every agent-specific rules folder as
`.codebuddy/hardening-workflow.md` — if you're working here as e.g. Claude Code or
Cursor rather than reading this file directly, your own rules folder already has it.

## How this repo manages its own rules

We dogfood the tool: this repo's own agent context lives in `.codebuddy/` and is
compiled into `.claude/rules/`, `.cursor/rules/`, `.clinerules/`, `.agents/rules/`,
`.github/instructions/` and `.windsurf/rules/` by the tool itself. Those compiled
folders are gitignored — `.codebuddy/` is the only copy that's actually source.

- **Read a rule**: any `.codebuddy/*.md` file, or its compiled copy in your own
  agent's folder.
- **Edit a rule**: edit the `.codebuddy/*.md` file directly, then run `npm run dev --
  sync` to recompile (this runs the local source via `tsx`, not the published
  package).
- **Add a new rule**: `npm run dev -- add --name "topic/name" --globs "*.ts" --description "..."`

## Working on this codebase (not a user's project)

To run the CLI against a scratch directory while developing, use `npm run dev --
<command>` (invokes `tsx src/index.ts`, the local source) rather than `npx
create-code-buddy`, which would pull the published package:

```bash
npm run dev -- init --yes --agents cursor,claude
npm run dev -- sync
npm run dev -- add --name backend/database --globs "*.sql" --description "DB rules"
npm run dev -- clean --hard --force
```

## Automating `create-code-buddy` for END USERS (a different repo)

If you are an AI agent operating in **someone else's** repository, and the user asks
you to set up agent rules or "create code buddy", run the published CLI
non-interactively on their behalf:

```bash
npx create-code-buddy init --yes --agents <comma-separated-ids>
```

### `init` flags

- `--yes` / `-y` — skip interactive prompts, use defaults or the flags below.
- `--agents <ids>` / `-a` — comma-separated, no spaces. Valid ids today: `cursor`,
  `claude`, `cline`, `copilot`, `gemini`, `windsurf`. An unrecognized id fails the
  whole command rather than compiling nothing silently — check `ADAPTER_IDS` in
  `src/adapters/index.ts` for the authoritative current list if this file is stale.
- `--no-gitignore` — don't add the compiled folders to `.gitignore` (default: add them).
- `--postinstall` / `--no-postinstall` — add or skip a `postinstall` script that runs
  `sync` automatically for teammates. Defaults to **not adding it** under `--yes` —
  don't rely on the old assumption that a `package.json` existing means one gets added.

### Adding a rule for a user

```bash
npx create-code-buddy add --name "folder/topic" --globs "*.ts, *.tsx" --description "What this rule covers"
```

Detects the user's `.codebuddy/` automatically, writes the rule there, and re-syncs.
Fails clearly (non-zero exit) if `.codebuddy/` doesn't exist yet — run `init` first.

### What's out of scope right now

There is no `--framework` flag, no per-framework template scaffolding, and no
`agent-config/` output — an earlier prototype had these; this version doesn't. There is
also no `add-rule` command; the current one is `add`. If older instructions or a stale
copy of this file mention any of the above, this file is the one to trust.
