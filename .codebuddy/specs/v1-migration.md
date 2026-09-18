---
description: Technical specification for the Official V1 Hivemind Rebrand and Migration system
globs: ["src/**/*.ts"]
status: parked
---

# Official V1 Migration (Code Buddy to Hivemind)

This specification outlines the logic for migrating legacy beta workspaces to V1.0.0.

## Detection
All CLI commands MUST run a `checkVersion()` utility before executing.
- **Legacy Beta Check**: If a `.codebuddy` directory exists, block execution and prompt the user to run `npx hm upgrade` (with a changelog link).
- **Future Versioning**: Once inside `.hivemind`, check `config.version`. If missing or outdated, handle updates accordingly.

## The Upgrade Command (`src/upgrade.ts`)
The upgrade command must be non-destructive and bulletproof.

### Safety Checks
1. Abort if the Git working tree has uncommitted changes.
2. Create a `.tar.gz` backup of the legacy `.codebuddy` directory.
3. Prompt for explicit confirmation `[Y/n]`.

### Execution Steps
1. Rename folder: `.codebuddy` -> `.hivemind`.
2. Rename core file: `.hivemind/codebuddy-system.md` -> `.hivemind/hivemind-system.md`.
3. Update `.hivemind/config.json`: Inject `"version": "1.0.0"`.
4. Update `package.json`: Swap `"npx create-code-buddy sync"` with `"npx hivemind sync"`.
5. Update `.gitignore`: Swap the start/end watermark blocks.
6. Update `AGENTS.md`: Swap the universal pointer block text.

## Rebranding
Update `package.json` to `"name": "hivemind-ai"`, `"version": "1.0.0"`, and map `bin` to `hm` and `hivemind`.

## Testing
MUST include Vitest integration tests mocking a legacy beta `.codebuddy` folder structure and asserting the exact V1 `.hivemind` output.
