---
description: Import rules a project already has into the .codebuddy SSOT
status: backlog
---

# Adopt Existing Rules (the import flow)

Most projects that install Code Buddy already have rules — a `.cursor/rules/` folder,
a `.github/instructions/` directory, something hand-written. Today there is no way to
bring those in: you either retype them into `.codebuddy/rules/` or abandon them. That
is the single biggest friction point for adopting the tool.

## Status: unblocked

This was parked for a specific, recorded reason:

> *"Good feature, wrong order: importing hand-written rules with the current parser
> would mangle exactly the block-list YAML from Task 1.3. Ship after Phase 1."*

Phase 1 shipped. The line-splitting parser that would have mangled a `globs:` block
list is gone, replaced by real YAML parsing in `src/core/rule.ts`. Nothing blocks this
now.

## Triggers

1. **During `init`** — scan for existing rules and offer to adopt them:
   *"Found 4 rules in .cursor/rules. Import them into .codebuddy/rules/?"*
2. **On demand** — `npx create-code-buddy import`, for projects that ran `init` before this existed.

## Detection

Scan the rules directory each adapter already declares, rather than a hardcoded list.
`src/adapters/` is a registry; `adapter.rulesDir` is the directory, and reading the
list from there means a seventh adapter is covered the day it's added instead of
whenever someone remembers this file.

**Skip anything carrying the watermark.** A generated file is our own output — importing
it would round-trip a rule back into the SSOT it came from and duplicate it.

## Interactive selection

`@clack/prompts` `multiselect`, defaulting to everything found:

```text
Which existing rules should be imported?
[x] backend-auth.mdc (Cursor)
[ ] ui-components.mdc (Cursor)
[x] testing.md (Copilot)
```

## Conversion

Per selected file:

1. **Parse** its agent-specific frontmatter. This is the part that needs care — each
   adapter writes a different shape, and they are not symmetric: Cursor uses bare
   comma-joined `globs:` that is deliberately not valid YAML, Copilot uses a
   single-quoted `applyTo:` string, Cline and Claude use a `paths:` block list,
   Windsurf uses `trigger:` plus `globs`.
2. **Normalize** to the SSOT's own shape — `description` and `globs` — via the existing
   `Rule` model in `src/core/rule.ts`. Do not write a second parser; the adapters
   already encode every format this needs to read, and reusing them is what keeps
   import and compile from drifting apart.
3. **Write** to `.codebuddy/rules/<basename>.md`.
4. **Leave the original alone.** The next `sync` overwrites it with the compiled,
   watermarked version. Deleting it here would destroy the user's file before they had
   seen what we made of it.

## Requirements

- **Dry run first.** Show exactly what would be imported and where it lands before
  writing anything, matching how `migrate` already behaves.
- **Never overwrite.** A name that already exists in `.codebuddy/rules/` is a
  collision: report it and skip, the way `src/migrate.ts` refuses rather than picking
  a winner.
- **Round-trip test.** For each adapter: compile a rule out, import it back, and assert
  the result matches the original. That is the test that proves the conversion is
  lossless, and it can be written before any of the rest.
