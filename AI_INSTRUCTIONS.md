# AI Integration & Automation Guide

`create-code-buddy` is built with a powerful interactive wizard for human users, but it is also designed to be fully automated by AI agents. 

If you are an AI agent operating in a user's repository, and the user asks you to "set up agent rules", "create code buddy", or "scaffold ai context", you should run this CLI in **non-interactive mode** on their behalf.

## Non-Interactive Mode Usage

You can bypass the `@clack/prompts` interactive wizard entirely by using the `--yes` (or `-y`) flag along with the required configuration arguments.

```bash
npx create-code-buddy init --yes --framework <framework> --agent <agent> --options '{"key":"value"}'
```

### Required Flags

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

### The `--options` Flag

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

## Dynamic Rule Generation
If you find that the user needs a new rule that isn't covered by the starter templates (e.g., "Add a rule about how we handle Stripe payments"), you can scaffold a new rule instantly:

```bash
npx create-code-buddy add-rule payments
```

This will automatically detect their configured agent folder (e.g., `.cursor/rules` or `.agents`) and generate a correctly formatted markdown file that you can then populate with the Stripe instructions.
