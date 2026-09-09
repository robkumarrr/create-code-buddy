export const BASELINE_RULES: Record<string, { description: string, globs: string, content: string }> = {
  'architecture.md': {
    description: 'High-level architecture and system design guidelines',
    globs: '"*.*"',
    content: '# Architecture\n\n[Add your architectural rules here...]'
  },
  'testing.md': {
    description: 'Testing standards, frameworks, and conventions',
    globs: '"*.test.*", "*.spec.*", "**/__tests__/**"',
    content: '# Testing\n\n[Add your testing rules here...]'
  },
  'conventions.md': {
    description: 'General coding conventions and style guidelines',
    globs: '"*.ts", "*.js", "*.tsx", "*.jsx", "*.php", "*.cs", "*.go", "*.py"',
    content: '# Conventions\n\n[Add your coding conventions here...]'
  },
  'codebuddy-system.md': {
    description: 'Instructions for AI agents on how to manage their own rules',
    globs: '"*.*"',
    content: `# Create-Code-Buddy: AI Instructions

Manage rules exclusively via the \`.codebuddy/\` SSOT folder. DO NOT edit these compiled directories directly:
- \`.claude/rules/\`
- \`.clinerules/\`
- \`.cursor/rules/\`
- \`.agents/\`
- \`.github/instructions/\`
- \`.windsurf/rules/\`

- **Create**: Run \`npx ccb add --name "folder/rule" --globs "*.ts" --description "..."\`
- **Edit/Delete**: Modify or delete the \`.codebuddy/*.md\` files natively.
- **Sync**: ALWAYS run \`npx ccb sync\` after manual edits to compile changes globally.

## Agent Identity → --agents flag
Pass \`--agents\` as a comma-separated string (no spaces) matching your runtime:

- \`claude\`   → Claude Code, Claude.ai (Anthropic)
- \`cline\`    → Cline (VS Code extension), Continue.dev
- \`cursor\`   → Cursor IDE, Aider
- \`gemini\`   → Gemini, Antigravity, Google AI Studio, Gemini CLI
- \`copilot\`  → GitHub Copilot, VS Code Copilot extension
- \`windsurf\` → Windsurf, Codeium

Example — Antigravity running non-interactively:
  npx ccb init --yes --agents gemini

Multiple agents (comma-separated, no spaces):
  npx ccb init --yes --agents gemini,cursor
`
  }
};
