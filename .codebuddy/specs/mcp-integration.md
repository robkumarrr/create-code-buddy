---
status: "to-do"
priority: "medium"
type: "feature"
---
# MCP Server Integration

## Goal
Expose Code Buddy's core operations as an MCP (Model Context Protocol) server so AI agents can manage rules programmatically without shelling out to the CLI.

## Why
- Shell commands (`npx ccb add ...`) are fragile — agents mistype flags, sandboxes block execution, and there's no structured error handling.
- MCP is the emerging standard (adopted by Anthropic, Cline, Cursor, and others) for agent-to-tool communication.
- An MCP server makes Code Buddy a first-class citizen in any agent's toolbelt — discoverable, typed, and reliable.

## Proposed MCP Tools

| Tool | Arguments | Description |
|------|-----------|-------------|
| `ccb_list_rules` | none | Returns all rules in `.codebuddy/` with their frontmatter metadata |
| `ccb_get_rule` | `name: string` | Returns the full content of a specific rule |
| `ccb_add_rule` | `name, globs, description, content` | Creates a new rule and auto-syncs |
| `ccb_edit_rule` | `name, content` | Updates an existing rule's content and auto-syncs |
| `ccb_delete_rule` | `name` | Deletes a rule and auto-syncs |
| `ccb_sync` | none | Compiles all rules to configured agent directories |
| `ccb_audit` | none | Returns token estimates per rule and flags always-on overuse |

## Architecture Ideas
- Ship as `npx create-code-buddy mcp` (starts a stdio MCP server)
- Or ship as a standalone `@create-code-buddy/mcp` package
- Use the `@modelcontextprotocol/sdk` TypeScript SDK
- The MCP server would import our existing `sync.ts`, `add.ts`, `clean.ts` functions directly — zero code duplication

## Open Questions
- [ ] Should the MCP server auto-start via a postinstall hook, or require manual invocation?
- [ ] Do we support SSE (server-sent events) transport for remote/cloud agents, or just stdio for local?
- [ ] Should `ccb_add_rule` auto-sync immediately, or batch changes and sync on explicit `ccb_sync` call?
- [ ] How do we handle the glob overuse warning through MCP? Return it as a warning field in the response?
