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
    content: `# AI Agent Self-Management

You are equipped with a Create-Code-Buddy knowledge base. If the user asks you to add, modify, or delete a project rule or standard, you should NOT edit files directly in hidden agent folders like \`.cursor/rules\` or \`.agents\`.

Instead, follow this workflow:
1. To create a new rule, ALWAYS use the non-interactive CLI command:
\`\`\`bash
npx ccb add --name "folder/rule-name" --globs "*.ts, *.js" --description "What this rule does"
\`\`\`

2. If you need to modify an existing rule, edit the relevant Markdown file inside the \`.codebuddy/\` directory.
3. After making any manual modifications or deletions in \`.codebuddy/\`, run the compiler to magically sync the changes to all supported IDEs:
\`\`\`bash
npx ccb sync
\`\`\`
`
  }
};
