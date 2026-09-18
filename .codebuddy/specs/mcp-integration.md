---
description: Expose Code Buddy's commands as typed MCP tools
status: backlog
---

# MCP Server

## Goal

Expose Code Buddy's operations as MCP tools so agents manage rules and specs through a
typed interface instead of shelling out to the CLI.

## Why

- Shell commands are fragile. Agents mistype flags, sandboxes block execution, and
  there is no structured error handling — a failed `npx ccb add` looks much like a
  successful one to a model that cannot see the exit code.
- A rules file asking an agent to run a command is documentation. A typed
  `get_rules_for_file(path)` is capability.
- It loads on demand rather than always-on. `AGENTS.md` is the zero-config floor
  beneath this for agents that do not speak MCP; MCP is the ceiling.

## Naming

**No prefix.** MCP clients namespace tools by server, so `ccb_list_rules` renders as
stutter — `ccb:ccb_list_rules`. Tools are `list_rules`, `get_rule`, `sync`.

## What gets exposed

A command earns a tool when all three hold:

1. An agent can supply every input explicitly — no interactive fallback.
2. Its effects are recoverable, or fully reported back.
3. It needs no human consent.

This rule is the point of this section. It decides the cases below, and the ones
nobody has thought of yet.

### Rules

| Tool | Arguments | Notes |
|---|---|---|
| `list_rules` | — | Every rule in `.codebuddy/rules/` with its frontmatter. |
| `get_rule` | `name` | Full content of one rule. |
| `add_rule` | `name, description, globs?, content?` | Mirrors `ccb add`. |
| `update_rule` | `name, content` | |
| `delete_rule` | `name` | Recoverable: the source is in git, and `sync` rebuilds compiled copies. |

### Specs

The gap this spec exists to close. Phase 6 made specs first-class — indexed into
`AGENTS.md` with a status, deliberately never compiled — but nothing exposes them
programmatically, and there is still no way to create one except by hand.

| Tool | Arguments | Notes |
|---|---|---|
| `list_specs` | — | Path, description, status. What `AGENTS.md` indexes, as data. |
| `get_spec` | `name` | |
| `add_spec` | `name, description, status?` | Closes the manual gap — `ccb add` writes rules only. |
| `set_spec_status` | `name, status` | |

`set_spec_status` is what makes a spec track live work instead of being a static
document, which is why `status` exists at all. Values are `backlog`, `in-progress`,
`in-review`, `done` — the columns most ticket boards use. Unvalidated by design:
unknown values still render, so an unfamiliar word degrades to a label rather than an
error.

### Project

| Tool | Arguments | Notes |
|---|---|---|
| `sync` | — | Compile and re-index. Report what was written *and removed*, as the CLI does. |
| `init` | `agents, gitignore?, agents_md?` | Explicit args only. Every decision the wizard asks a human becomes a required argument. |
| `migrate` | `apply?` | Dry-run default preserved. |
| `clean` | — | **Safe form only** — removes compiled output, which `sync` rebuilds. |

### Deliberately not exposed

- **`clean --hard`.** Deletes `.codebuddy/` itself. Irreversible, destroys the source
  of truth, and the CLI already demands interactive confirmation. Fails rules 2 and 3.
  No confirmation argument makes it safe — it would sit one hallucinated string away
  from destroying a user's work.
- **The interactive `list` navigator.** It opens an editor. `list_rules` is its data
  form; there is nothing else to expose.

### Candidate, not parity

- **`audit`** — token estimates per rule, flagging always-on overuse. Genuinely useful,
  and a real problem: a rule with `globs: ["*.*"]` rides along on every turn. But it is
  a **new capability with no CLI equivalent**, not part of exposing what exists. Decide
  it separately; do not let it block the server shipping.

## Architecture

- Ship as `npx create-code-buddy mcp`, starting a stdio server.
- Use the `@modelcontextprotocol/sdk` TypeScript SDK.
- **Import the existing functions.** `syncAgents`, `addEntry`, `migrate` and the
  adapter registry already do this work and are covered by the existing suite. The
  server is a transport over them, not a second implementation — the moment it
  reimplements anything, the two drift and the tests guard only one.
- That has a prerequisite: those functions are CLI-shaped today. They print through
  `console.log`, signal failure via `process.exitCode`, and warn with
  `console.log(pc.yellow(...))`. Expect to thread a result object back instead, which
  is the real work of this feature.

## Open questions

- stdio only, or SSE for remote agents too? Start with stdio.
- Does `add_rule` sync immediately, or batch until an explicit `sync`?
- How do parse warnings surface? They are printed today; over MCP they need to ride
  back in the response.
- Does the server need a write lock? Two agents calling `sync` against one workspace is
  a real scenario once this is discoverable.

## Related

- `branch-aware-specs.md` — once specs know their branch, `list_specs` can answer
  "what am I working on?" rather than "what exists?"
- `spec-dependencies.md` — if specs gain dependency fields, `list_specs` should report
  what is actually startable.
