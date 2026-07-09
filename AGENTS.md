# Agentic Guidelines for `create-code-buddy`

Welcome, AI Agent! If you are reading this file, you are currently assisting a contributor with the `create-code-buddy` repository.

## Project Context
- **Name**: `create-code-buddy`
- **Purpose**: A CLI tool that automatically scaffolds perfect, token-minimized context rules for AI agents (Cursor, Copilot, Gemini) across various frameworks.
- **Stack**: Node.js, TypeScript, Vitest, Commander.js, `@clack/prompts`, EJS.
- **Testing**: We maintain a 100% unit test coverage using Vitest. Always run `npm run test` before committing.

## 🚀 Setting Up Your Local Agent Rules
We believe in "dogfooding" our own product. This repository does not contain hard-coded `.cursorrules` or `.agents/` folders because we want you (the agent) to generate them dynamically!

Before you make any changes to this repository, **you must execute the following command to generate your own local rules**:

```bash
npx tsx src/index.ts init --yes --framework nodejs --agent generic --options '{"architecture":"express","language":"typescript"}'
```

*Note: Since you are currently inside the source code of the tool, running `npx tsx src/index.ts` allows you to test the local version of the CLI directly, rather than pulling the public version from NPM.*

After you run that command, the CLI will scaffold an `agent-config/` folder containing the rules you need to follow regarding TypeScript conventions, clean code, and testing standards. Read those files, and let's get to work!

---

## Automating `create-code-buddy` for Users

If you are an AI agent operating in a user's repository (NOT this repository), and the user asks you to "set up agent rules", "create code buddy", or "scaffold ai context", you should run this CLI in **non-interactive mode** on their behalf.

### Non-Interactive Mode Usage

You can bypass the interactive wizard entirely by using the `--yes` (or `-y`) flag along with the required configuration arguments.

```bash
npx create-code-buddy init --yes --framework <framework> --agent <agent> --options '{"key":"value"}'
```

#### Required Flags

- `--yes` or `-y`: Tells the CLI to skip all interactive prompts and immediately generate files.
- `--framework` or `-f`: The framework stack to scaffold. Available options:
  - `laravel`
  - `nextjs`
  - `nodejs`
  - `csharp-dotnet`
  - `general`
  - `empty`
- `--agent` or `-a`: The target AI agent ecosystem to generate rules for. Available options:
  - `gemini` (Generates `.agents/` standard format)
  - `cursor` (Generates `.cursor/rules/` with `.mdc` files)
  - `copilot` (Generates `.github/instructions/`)
  - `generic` (Generates generic `agent-config/` standard markdown files)

#### The `--options` Flag

Many frameworks require additional context to generate the "Golden Templates" accurately. You can pass a JSON string to the `--options` (or `-o`) flag to provide this data. 

**Next.js Options:**
```bash
npx create-code-buddy init -y -f nextjs -a cursor -o '{"router":"app","styling":"tailwind"}'
```
- `router`: `app` or `pages`
- `styling`: `tailwind` or `css-modules`

**Laravel Options:**
```bash
npx create-code-buddy init -y -f laravel -a gemini -o '{"frontend":"livewire","testing":"pest"}'
```
- `frontend`: `blade`, `livewire`, `inertia-vue`, `inertia-react`, `inertia-svelte`, `api-only`
- `testing`: `pest` or `phpunit`

*(If you omit the `--options` flag, the CLI will automatically fallback to sensible, modern defaults like App Router for Next.js, and Livewire/Pest for Laravel).*

### Dynamic Rule Generation
If you find that the user needs a new rule that isn't covered by the starter templates (e.g., "Add a rule about how we handle Stripe payments"), you can scaffold a new rule instantly:

```bash
npx create-code-buddy add-rule payments
```

This will automatically detect their configured agent folder (e.g., `.cursor/rules` or `.agents`) and generate a correctly formatted markdown file that you can then populate with the Stripe instructions.
