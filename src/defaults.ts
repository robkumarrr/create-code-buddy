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
1. Edit or create the relevant Markdown file inside the \`.codebuddy/rules/\` directory.
2. Ensure every rule file begins with YAML frontmatter specifying a \`description\` and \`globs\` (e.g. \`globs: ["*.ts"]\`).
3. After making the changes, explicitly instruct the user to run the following command in their terminal to compile the updates:

\`\`\`bash
npx ccb sync
\`\`\`
`
  }
};
