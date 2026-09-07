# 🤖 create-code-buddy (ccb)

`create-code-buddy` is the ultimate Single Source of Truth (SSOT) compiler for AI Agent rules.

The AI coding ecosystem is incredibly fragmented. If half your team uses **Cursor** and the other half uses **GitHub Copilot** or **Gemini**, how do you manage your project's AI context? Do you maintain `.cursorrules`, `.github/instructions/`, and `.agents/` separately? 

No. With `create-code-buddy`, you write your team's rules exactly **once** in the `.codebuddy/` folder. Then, our CLI instantly compiles and perfectly formats those rules for whatever AI IDE your developers prefer to use.

---

## 🚀 Quick Start

Run the interactive setup wizard in the root of your project:

```bash
npx create-code-buddy init
# Or use the shortcut alias:
npx ccb init
```

The wizard will smoothly guide you through:
1. **Selecting your AI Agents** (Cursor, Gemini, Copilot, or Generic).
2. **Git Ignore Settings** (Automatically hiding the compiled outputs).
3. **Team Automation** (Injecting a `postinstall` script).

This generates your `.codebuddy/` folder with baseline architectural and testing rules, and magically compiles them into your local agent folders (like `.cursor/rules/`).

---

## 🛠️ The CLI Toolkit

All commands can be run using `npx create-code-buddy <command>` or the shorter `npx ccb <command>`.

### 1. The Configuration Wizard (`init` / `edit` / `config`)
```bash
npx ccb init
```
Acts as a smart settings manager. It scaffolds your initial `.codebuddy/` SSOT. If you run it again later, it remembers your choices and acts as a buttery-smooth TUI to let you toggle supported AI agents for your local machine.

### 2. The Knowledge Base Manager (`add`)
```bash
npx ccb add
```
Never manually create folders or copy-paste frontmatter again. This command opens an interactive menu allowing you to:
- Create nested directories inside `.codebuddy/`.
- Add new Markdown entries.
- Select target Globs (e.g., Backend, Frontend, Testing) via a multiselect menu.
- Immediately syncs your new rules to your active AI agents.

### 3. The SSOT Compiler (`sync`)
```bash
npx ccb sync
```
The heart of the tool. It reads your `.codebuddy/` folder and mirrors it perfectly into your IDE's proprietary folder structures (like `.cursor/rules/*.mdc`). 
*✨ Features **Smart Merge**: It safely overwrites and cleans up stale SSOT rules while permanently protecting any personal, un-synced rules developers might have created in their own `.cursor` folders!*

### 4. The Navigator (`list`)
```bash
npx ccb list
```
A visual tree explorer for your AI rules. Select any rule in your `.codebuddy/` folder to instantly generate a clickable terminal link that opens the file right in your editor.

### 5. The Slate Wiper (`clean`)
```bash
npx ccb clean
# Or for a full factory reset:
npx ccb clean --hard
```
Safely deletes all compiled/hidden agent folders (like `.cursor/` or `.github/`) and cleans your `.gitignore`. It **protects** your `.codebuddy/` source code. *(Use `--hard` if you want to completely obliterate the SSOT as well).*

---

## 🤝 The "Magic" Team Workflow

Because `.codebuddy/` is an IDE-agnostic Single Source of Truth, **you should commit it to your Git repository!**

When a new Junior Developer joins your team and clones the repo, they don't have to configure anything. During the `npx ccb init` wizard, we ask if you want to add a `postinstall` script. If you select "Yes", we inject this into your `package.json`:

```json
"scripts": {
  "postinstall": "npx create-code-buddy sync"
}
```

Now, when that new developer runs `npm install`, `create-code-buddy` automatically compiles the team's rules perfectly for their specific AI agent in the background. **Zero-touch onboarding.**

---

## 🤖 AI Automation (Non-Interactive Mode)

`create-code-buddy` is designed to be fully automatable by other AI agents. If you are an AI agent setting up a workspace for a user, you can bypass the interactive prompts by using the `--yes` (`-y`) flag.

```bash
npx ccb init --yes --agents cursor,gemini
```
