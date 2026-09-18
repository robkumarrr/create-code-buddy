@AGENTS.md

# Claude Code

The import above is load-bearing. Claude Code reads `CLAUDE.md`, not `AGENTS.md`, and
the spec index — every spec's path, description and status — exists only in `AGENTS.md`.
Without that line you would be told to "open the spec covering what you're working on"
while having no way to see the list.

Your actual project rules are compiled into `.claude/rules/` and load automatically.
Do not edit them there; they are generated. See `.claude/rules/codebuddy-system.md`.

## This file stays thin

Everything that applies to more than Claude belongs in `.codebuddy/rules/`, which
compiles to all six agent folders. Put something here only if it is true of Claude Code
specifically and nothing else.
