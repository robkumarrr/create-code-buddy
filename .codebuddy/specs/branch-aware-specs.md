---
description: Surface the spec that matches the branch you are actually on
status: backlog
---

# Branch-Aware Specs

## The problem

`AGENTS.md` lists every spec with its status and tells the agent to open the relevant
one. With three specs that is fine. With fifteen it is a guess, and a wrong guess is
worse than no list — the agent reads a spec for work nobody is doing.

The tool already knows which branch you are on. It just doesn't use it.

This is the original intent behind specs: connect a spec to what someone is actually
working on. File globs were the first attempt and they fit badly — a spec isn't
relevant because you touched a `.ts` file, it's relevant because you're building the
thing it describes. A branch says that directly.

## The change

Spec frontmatter gains an optional `branch:`.

```markdown
---
description: Expose Code Buddy's commands as typed MCP tools
status: in-progress
branch: feat/mcp-*
---
```

`sync` reads the current branch and renders the matching spec in its own section above
the index:

```markdown
## Active spec

You are on `feat/mcp-server`, which matches this spec. Read it before making changes.

- `.codebuddy/specs/mcp-integration.md` — Expose Code Buddy's commands as typed MCP
  tools — in-progress

## Project specs

- `.codebuddy/specs/adopt-existing-rules.md` — Import rules a project already has — backlog
- ...
```

## Design decisions

**Match by pattern, not exact string.** `feat/mcp-*` survives a rename and covers a
feature split across several branches. Exact matching breaks the first time someone
writes `feat/mcp-server-2`.

**Never hide the others.** The full index stays below. An agent working on MCP may
still legitimately need to read the import spec — promoting one is help, hiding the
rest is a trap.

**No match is the normal case, not an error.** On `main`, or on a branch no spec
claims, the output is exactly what it is today. Say nothing rather than warning; most
branches have no spec and that is fine.

**Do not auto-derive status from git.** Branch exists → `in-progress`, PR open →
`in-review`, merged → `done` is the obvious next step and it is deliberately not step
one. It couples the tool to a specific host and to network access, and it would let the
index change without anyone editing anything. Revisit once the basic matching has
proven itself.

**Two specs claiming the same branch is a warning, not a failure.** List both under
Active and say so. Compare `warnAboutUnknownSubdirs` in `src/sync.ts` for the tone —
tell the user what was ambiguous, then carry on.

## Implementation notes

- Reading the branch must not require git. A project without a repo is valid; a failed
  read means "no active spec" and nothing else. No spawned `git` binary in the happy
  path if it can be read from `.git/HEAD`.
- The rendering hook is `renderBlock` in `src/core/agents-md.ts`, which already takes
  rules and specs separately.
- `branch:` parses the same way `status:` does — `src/core/rule.ts`, a trimmed string,
  unvalidated.
- Worth pinning by test: a matching branch promotes exactly one spec, a non-matching
  branch changes nothing, a missing `.git` changes nothing, and the full list is
  present in all three cases.

## Why after MCP

Nothing here blocks MCP, and MCP makes it better: `list_specs` can answer *"what am I
working on?"* instead of *"what exists?"* once specs know their branch. Building it
first would mean a third PR before the thing we have been aiming at.

## Related

- `spec-dependencies.md` — the other half of giving specs context. Both add frontmatter
  that relates a spec to something outside itself, and they should agree on how that
  reads.
