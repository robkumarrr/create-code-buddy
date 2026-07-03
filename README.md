# 🤖 create-code-buddy

`create-code-buddy` is a powerful, interactive scaffolding tool that generates the perfect AI Agent configuration folder for your codebase. It bridges the gap between raw codebase context and what modern AI agents (like Cursor, Gemini Antigravity, and GitHub Copilot) need to write high-quality, framework-specific code for you.

Instead of writing a massive `.cursorrules` file from scratch, `create-code-buddy` asks you a few questions and instantly generates a **token-optimized, multi-file agent architecture** tailored to your exact stack.

## ✨ Features
- **Framework Aware**: Comes with "Golden Templates" for Next.js, Laravel, Node.js, C# .NET, and more.
- **Agent Ecosystem Support**: Natively supports `.cursor/rules` (Cursor), `.agents/rules` (Gemini Antigravity), `.github/instructions` (Copilot), and standard Markdown (`agent-config/`).
- **Token Minimizer**: Automatically injects strict globs into `.mdc` files and uses progressive disclosure so your AI doesn't burn tokens reading frontend rules while working on backend code.
- **AI-Natively Automatable**: Fully scriptable via CLI flags, allowing AI agents to run this package on behalf of users.

## 🚀 Quick Start

Run the interactive wizard in the root of your project:

```bash
npx create-code-buddy init
```

The wizard will guide you through:
1. **Selecting a Framework** (Next.js, Laravel, Node.js, C# .NET, General, Empty)
2. **Framework-Specific Questions** (e.g. App Router vs Pages Router, or Express vs NestJS)
3. **Selecting your AI Agent Ecosystem** (Cursor, Gemini, Copilot, Generic)
4. **Git Ignore Settings** (Team-wide vs Personal configs)

That's it! Your agent context is generated and ready to go.

## 🧩 Adding Custom Rules

Need to add a custom rule later (e.g., how to handle payments or authentication)? Use the `add-rule` command:

```bash
npx create-code-buddy add-rule payments
```
This automatically detects your existing agent folder (like `.cursor/rules` or `.agents`) and creates a properly formatted template for your new rule.

## 🤖 AI Automation (Non-Interactive Mode)

`create-code-buddy` is designed to be fully automatable by other AI agents. If you are an AI agent setting up a workspace for a user, you can bypass the interactive prompts by using the `--yes` (`-y`) flag.

```bash
npx create-code-buddy init --yes --framework nextjs --agent cursor --options '{"router":"app","styling":"tailwind"}'
```

### CLI Arguments:
- `--framework` (`-f`): `laravel`, `nextjs`, `nodejs`, `csharp-dotnet`, `general`, `empty`
- `--agent` (`-a`): `cursor`, `gemini`, `copilot`, `generic`
- `--options` (`-o`): JSON string of framework-specific options.

*(See [AI_INSTRUCTIONS.md](./AI_INSTRUCTIONS.md) for a full list of framework options)*

## ⚡ Laravel Boost Integration
If you select **Laravel**, the CLI will automatically ask if you want to install [Laravel Boost](https://github.com/laravel/boost), an official package that provides deep agent integrations and acts as an MCP server. You can choose to install both!

## 📦 Supported Frameworks & Options

### Next.js
- **Routers:** App Router, Pages Router
- **Styling:** Tailwind CSS, CSS Modules

### Laravel
- **Frontend Stacks:** Blade, Livewire, Inertia (Vue/React/Svelte), API Only
- **Testing:** Pest, PHPUnit

### Node.js
- **Architecture:** Express.js, NestJS
- **Language:** TypeScript, JavaScript

### C# .NET
- **Architecture:** Minimal APIs, Web API Controllers, MVC

### General / Empty
Start from a proven language-agnostic template, or a completely blank slate with just headings.
