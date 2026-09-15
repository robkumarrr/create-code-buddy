---
description: Technical specification for importing and adopting existing agent rules into Hivemind
globs: ["src/import.ts", "src/init.ts"]
---

# Feature: Adopt Existing Rules (The Import Flow)

When users install Hivemind, they often already have rules in agent-specific folders (e.g., `.cursor/rules/`). Hivemind MUST provide an interactive way to adopt these rules into the `.hivemind/` SSOT.

## Triggers
1. **During Init**: `hm init` should scan for existing rules. If found, prompt: *"We found X existing rules in .cursor/rules. Would you like to import them into Hivemind?"*
2. **Manual Command**: Provide a dedicated `npx hm import` command.

## Detection Phase
The CLI should scan known directories for user-created rules (ignoring files that already have the Hivemind watermark):
- `.cursor/rules/*.mdc`
- `.github/instructions/*.md`
- `.windsurf/rules/*.md`

## Interactive Selection
Use `@clack/prompts` `multiselect` to present the found files to the user:
```text
Which existing rules would you like to import into Hivemind?
[x] backend-auth.mdc (Cursor)
[ ] ui-components.mdc (Cursor)
[x] testing.md (Copilot)
```

## Conversion Logic
For each selected file:
1. **Parse**: Read the file and parse its agent-specific frontmatter (e.g., Cursor uses `globs`, Copilot uses `applyTo`).
2. **Standardize**: Convert the frontmatter to the universal Hivemind format (`description`, `globs`).
3. **Migrate**: Write the new standardized file to `.hivemind/<basename>.md`.
4. **Cleanup**: The next `hm sync` run will automatically overwrite the old unmanaged file with the new watermarked, compiled file.
