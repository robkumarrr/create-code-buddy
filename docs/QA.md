# Manual QA

A human pass over `create-code-buddy`. The automated suite covers the mechanics; this
covers what it structurally cannot — real terminal rendering, the interactive wizard,
a genuine install, and whether the six agents actually accept what we write.

Every scenario is tagged:

- **[auto]** — a test already pins this. You're checking that it *looks* right.
- **[manual]** — nothing covers this. Read carefully.

**Fast pass** (patch release): the **[manual]** items only.
**Full pass** (minor, major, or anything touching an adapter): everything.

---

## Table of contents

- [Before you start](#before-you-start)
- [Part 1 — User journeys](#part-1--user-journeys)
  - [A. New project, interactive](#a-new-project-interactive)
  - [B. New project, scripted](#b-new-project-scripted)
  - [C. A project that already has rules](#c-a-project-that-already-has-rules)
  - [D. Day-to-day editing](#d-day-to-day-editing)
  - [E. Changing which agents you use](#e-changing-which-agents-you-use)
  - [F. A teammate clones the repo](#f-a-teammate-clones-the-repo)
  - [G. Upgrading from an older version](#g-upgrading-from-an-older-version)
- [Part 2 — Command reference](#part-2--command-reference)
  - [init / edit / config](#init--edit--config)
  - [sync](#sync)
  - [add](#add)
  - [migrate](#migrate)
  - [list](#list)
- [Part 3 — Adapter output](#part-3--adapter-output)
- [Part 4 — Destructive paths](#part-4--destructive-paths)
- [Part 5 — Do the agents accept it?](#part-5--do-the-agents-accept-it)
- [Part 6 — Release checklist](#part-6--release-checklist)
- [Appendix — expected strings](#appendix--expected-strings)

---

## Before you start

```bash
cd /path/to/create-code-buddy
npm ci && npm run build
```

Drive the built binary directly. The `ccb` name only exists after an install, so define
a shell function pointing at the build:

```bash
ccb() { node /absolute/path/to/create-code-buddy/dist/index.js "$@"; }
```

Use a function, not `CCB="node …"`. A variable holding a two-word command does not
word-split in zsh (macOS's default shell), so `ccb sync` fails with
`no such file or directory`. The function works in both bash and zsh.

Every scenario below calls `ccb`, so it reads exactly like the real command.

**Always work in a scratch directory.** Several scenarios delete files.

```bash
cd "$(mktemp -d)"
```

A scratch project with a `package.json` behaves differently from one without — the
wizard gains a step. Test both.

[↑ Back to top](#table-of-contents)

---

## Part 1 — User journeys

How the tool is actually used. Run these first: this is where surprises live.

### A. New project, interactive

**[manual]** — the least-covered surface in the codebase. `prompts.test.ts` has five
tests against a four-step wizard with branching text and Go Back on three steps.

```bash
cd "$(mktemp -d)" && npm init -y >/dev/null && ccb
```

Step through and check each:

1. **Screen clears**, cyan ASCII logo, then a `create-code-buddy` banner.
2. Four-line welcome, ending dim: *"(We've pre-selected some defaults for you below…)"*
3. **Agent multiselect.** Each row is a padded label plus a dim coloured directory —
   `Cursor         (.cursor/rules)`. Cursor and Gemini preselected.
   - **Deselect everything and confirm.** Expect the yellow line
     `⚠  Select at least one agent to continue, or press Ctrl+C to exit at any time.`
     and the prompt repeating. It must not advance.
4. **Gitignore step.** Three options, the third `⬅️  Go Back`.
   - **Choose Go Back.** You must land on the agent step with your selection intact.
5. **Postinstall step** — only because this dir has a `package.json`.
   - Go Back here too; confirm you land on gitignore, not agents.
6. **AGENTS.md step.** Wording differs by whether `AGENTS.md` exists. In a fresh dir it
   should read *"Write a rule index to AGENTS.md?"* with
   *"Yes, create AGENTS.md with an index of the rules"*.
7. Finish. Expect green `Code Buddy has been configured successfully! 🚀`.

Then confirm on disk:

```bash
ls -R .codebuddy && cat .codebuddy/config.json && cat AGENTS.md && cat .gitignore
```

- `.codebuddy/rules/` holds the scaffolded baseline rules. **`.codebuddy/specs/` may not
  exist yet — that's expected**, specs are created by hand.
- `AGENTS.md` has a `create-code-buddy:start` / `:end` block.
- `.gitignore` has a `# --- Create Code Buddy (Start) ---` block listing **rule
  directories, not whole agent folders** — `.cursor/rules/`, never `.cursor/`.

**Now repeat and press Ctrl+C at each step.** Every one must print yellow
`Setup cancelled. No files were created.` and **exit 0**. Verify nothing was written:

```bash
ccb ; echo "exit=$?" ; ls -a
```

[↑ Back to top](#table-of-contents)

### B. New project, scripted

**[auto]** — this is the path an agent uses, and `cli.test.ts` covers it. Check output.

```bash
cd "$(mktemp -d)" && npm init -y >/dev/null
ccb init --yes --agents cursor,claude
```

Expect: SSOT initialised, a scaffolded-rules count, `Compiling rules…`, one
`✔ Compiled N rules → …` per agent, the AGENTS.md line, then the success outro. A fresh
project scaffolds **4** baseline rules.

Then verify the consent defaults, which exist because of a real past bug:

```bash
grep -c postinstall package.json   # expect 0 — --yes must NOT add it
```

**`--yes` never edits `package.json` unless you pass `--postinstall`.** If that count is
anything but 0, stop and file it.

Flag combinations to try, each in a fresh dir:

| Command | Expect |
|---|---|
| `init --yes --agents cursor --no-gitignore` | No `# --- Create Code Buddy` block in `.gitignore` |
| `init --yes --agents cursor --no-agents-md` | No `AGENTS.md` written |
| `init --yes --agents cursor --postinstall` | `"postinstall": "npx create-code-buddy sync"` present |
| `init --yes --agents nope` | Red `Unknown agent id: nope. Valid agents are: …`, exit 1, **no files created** |

**[manual]** `--no-agents-md` **interactively** must not ask about AGENTS.md at all — a
flag is an answer, not a default:

```bash
cd "$(mktemp -d)" && npm init -y >/dev/null && ccb init --no-agents-md
```

Three questions, not four. No AGENTS.md step.

[↑ Back to top](#table-of-contents)

### C. A project that already has rules

**[manual]** — the friction `adopt-existing-rules` describes. Confirm nothing is
destroyed while that's unbuilt.

```bash
cd "$(mktemp -d)" && mkdir -p .cursor/rules
printf -- '---\ndescription: Mine\nglobs: *.ts\n---\n\n# My own rule\n' > .cursor/rules/mine.mdc
ccb init --yes --agents cursor
cat .cursor/rules/mine.mdc
```

**The hand-written file must survive untouched.** It has no watermark, so nothing may
delete or rewrite it. There is no import yet — it simply isn't adopted, and that's
correct today.

[↑ Back to top](#table-of-contents)

### D. Day-to-day editing

**[auto]** for mechanics, **[manual]** for reporting accuracy.

```bash
cd "$(mktemp -d)" && ccb init --yes --agents cursor,claude
ccb add --name "backend/database" --globs "*.sql, *.prisma" --description "DB rules"
```

Expect `✔ Created .codebuddy/rules/backend/database.md`, then a sync.

```bash
cat .codebuddy/rules/backend/database.md      # globs: ["*.sql", "*.prisma"]
ls .cursor/rules/backend/ .claude/rules/backend/   # nesting preserved
```

Now delete it by hand and re-sync — **this is the reporting check**:

```bash
rm .codebuddy/rules/backend/database.md
ccb sync
```

Expect `(removed 1 stale)` on each agent line. A silent deletion is a bug. Then:

```bash
ls .cursor/rules/           # backend/ must be gone, not left empty
```

[↑ Back to top](#table-of-contents)

### E. Changing which agents you use

**[auto]**

```bash
cd "$(mktemp -d)" && ccb init --yes --agents cursor,claude
ccb init --yes --agents cursor        # drop claude
```

- `.claude/rules/` is collected — generated files gone.
- `.gitignore` no longer lists `.claude/rules/`.
- Re-add with `--agents cursor,claude` and sync; it comes back identically.

[↑ Back to top](#table-of-contents)

### F. A teammate clones the repo

**[manual]** — and this journey currently reproduces a known bug.

Compiled folders are gitignored by default, so a teammate gets `.codebuddy/` only:

```bash
cd "$(mktemp -d)"
mkdir -p .codebuddy/rules
echo '{"agents":["cursor"],"gitignore_compiled_agents":true}' > .codebuddy/config.json
printf -- '---\ndescription: Testing\nglobs: ["*.test.ts"]\n---\n\n# Testing\n' > .codebuddy/rules/testing.md
ccb sync && ls .cursor/rules/
```

Expect `✔ Compiled 1 rule → Cursor` and the file present. Note **"1 rule"** singular.

**Now the bug** — same thing, but the repo was never migrated (rules loose at the root):

```bash
cd "$(mktemp -d)"
mkdir -p .codebuddy
echo '{"agents":["cursor"],"gitignore_compiled_agents":true}' > .codebuddy/config.json
printf -- '---\ndescription: Testing\nglobs: ["*.test.ts"]\n---\n\n# Testing\n' > .codebuddy/testing.md
ccb sync ; echo "exit=$?"
```

Expect a yellow warning naming both files and telling you to run `migrate`, then
`- No rules to compile → Cursor` — **not** a green tick, because nothing was compiled.
Then confirm the way out actually works:

```bash
ccb migrate --apply && ccb sync
```

Now `✔ Compiled 2 rules → Cursor`. This was
[#39](https://github.com/robkumarrr/create-code-buddy/issues/39): the wipe guard only
fires when compiled output already exists, and with agent folders gitignored it usually
doesn't — so a fresh clone had rules it couldn't see and reported success.

[↑ Back to top](#table-of-contents)

### G. Upgrading from an older version

**[auto]**, but worth seeing.

```bash
cd "$(mktemp -d)"
mkdir -p .codebuddy .cursor/rules
echo '{"agents":["cursor"],"gitignore_compiled_agents":true}' > .codebuddy/config.json
printf -- '---\ndescription: Testing\nglobs: ["*.test.ts"]\n---\n\n# Testing\n' > .codebuddy/testing.md
printf '<!-- @generated by create-code-buddy -->\n# old\n' > .cursor/rules/testing.mdc

ccb sync ; echo "exit=$?"     # 1. must REFUSE, delete nothing
ls .cursor/rules/              #    old file still there
ccb migrate                   # 2. dry run — shows moves, changes nothing
ccb migrate --apply           # 3. moves into .codebuddy/rules/
ccb sync                      # 4. compiles normally again
```

Step 1 is the important one: a red error naming `migrate`, exit 1, **and the existing
compiled file untouched**. Deleting anything there would be the "silent wipe" bug.

Also check the **Gemini skill sweep** (removed in #36):

```bash
cd "$(mktemp -d)" && ccb init --yes --agents gemini
mkdir -p .agents/skills/codebuddy-system
printf '<!-- @generated by create-code-buddy -->\n# old skill\n' > .agents/skills/codebuddy-system/SKILL.md
ccb sync && find .agents
```

`.agents/skills/` must be gone entirely — file *and* folders. `.agents/rules/` stays.

[↑ Back to top](#table-of-contents)

---

## Part 2 — Command reference

Every command and flag, so nothing goes unexercised in a full pass.

### init / edit / config

`edit` and `config` are aliases for `init`. All three run the same wizard.

| Flag | Effect | Tag |
|---|---|---|
| `-y, --yes` | Skip prompts. Defaults: `cursor,gemini`, gitignore **on**, postinstall **off**, AGENTS.md **on** | [auto] |
| `-a, --agents <list>` | Comma-separated, no spaces. Invalid ids fail loudly | [auto] |
| `--no-gitignore` | No managed `.gitignore` block | [auto] |
| `--no-agents-md` | No `AGENTS.md`; interactively, skips that question | [manual] |
| `--postinstall` | Adds the postinstall script | [auto] |
| `--no-postinstall` | Explicitly declines it | [auto] |

**[manual]** Re-running `init` in a configured project should print dim
*"Found existing .codebuddy/config.json. Loading your settings…"* and preselect your
agents.

### sync

No flags. Check each output form appears:

- `✔ Compiled 5 rules → Cursor (.cursor/rules)` — one per agent, correct label and dir.
- `✔ Compiled 1 rule → …` — **singular** at exactly one.
- `- No rules to compile → Cursor (.cursor/rules)` — yellow, **no green tick**, when
  there was nothing to write. Try it with an empty `.codebuddy/rules/`.
- `(removed N stale)` — dim, only when something was deleted.
- Yellow `⚠ Found 2 files directly in .codebuddy/ …` naming them and pointing at
  `migrate` — see [Journey F](#f-a-teammate-clones-the-repo).
- `✔ Indexed rules in AGENTS.md` — only when enabled.
- Yellow `⚠ Ignoring .codebuddy/prompts/ — not a recognized folder.` — try
  `mkdir .codebuddy/prompts && touch .codebuddy/prompts/x.md`.
- Red, exit 1, when there's no config:
  ``No .codebuddy/config.json found. Run `npx create-code-buddy init` first.``

**[manual]** Sync twice with no changes. The second run must report the same counts and
change no file timestamps in a way that churns git.

### add

| Case | Expect | Tag |
|---|---|---|
| `add --name x --globs "*.ts" --description "d"` | `.codebuddy/rules/x.md`, then a sync | [auto] |
| `add --name "a/b"` | Nested dirs created; heading is `# b`, not `# a/b` | [auto] |
| `add --name x.md` | No `x.md.md` | [auto] |
| `add --name m --globs '*.ts, "*.tsx", *.jsx '` | `globs: ["*.ts", "*.tsx", "*.jsx"]` | [auto] |
| `add --name x` with no `.codebuddy/` | Red failure, exit 1, nothing created | [auto] |
| `add` with no flags | **[manual]** Interactive wizard — glob multiselect, custom glob entry, cancel at each step | [manual] |

### migrate

| Case | Expect | Tag |
|---|---|---|
| `migrate` | Lists moves, then yellow *"Nothing changed. Re-run with --apply"* | [auto] |
| `migrate --apply` | Green `✔ Moved N files.` plus a hint to sync | [auto] |
| Run twice | Green `✔ Already using the current layout — nothing to migrate.` | [auto] |
| Same name in both layouts | Red refusal listing collisions; **neither file altered** | [auto] |
| No `.codebuddy/` at all | Red failure, exit 1 | [auto] |

### list

**[manual]** — interactive, barely covered.

```bash
ccb list
```

Arrow through, select one, confirm the green `✔ Selected Entry!` and a correct relative
path. Cancel with Ctrl+C → yellow `Navigation cancelled.`. In an empty project → yellow
`No markdown rules found in .codebuddy.`

[↑ Back to top](#table-of-contents)

---

## Part 3 — Adapter output

**[auto]** by the golden snapshot, but eyeball it after any adapter change.

```bash
cd "$(mktemp -d)" && ccb init --yes --agents cursor,claude,cline,gemini,copilot,windsurf
ccb add --name scoped --globs "*.sql, *.prisma" --description "DB rules"
```

| Agent | Directory | Ext | Always-apply | Glob-scoped |
|---|---|---|---|---|
| Cline | `.clinerules` | `.md` | **No frontmatter** | `paths:` block list |
| Claude | `.claude/rules` | `.md` | **No frontmatter** | `paths:` block list |
| Cursor | `.cursor/rules` | `.mdc` | `globs: *.*` + `alwaysApply: true` | `globs: *.sql,*.prisma` |
| Gemini | `.agents/rules` | `.md` | `globs: "*.*"` | `globs: ["*.sql", "*.prisma"]` |
| Copilot | `.github/instructions` | `.instructions.md` | `applyTo: '*.*'` | `applyTo: '*.sql,*.prisma'` |
| Windsurf | `.windsurf/rules` | `.md` | `trigger: always_on` | `trigger: glob` + `globs:` |

**Deliberate oddities — not bugs:**

- **Cursor's `globs:` is not valid YAML.** Bare and comma-joined, because that is what
  Cursor parses. Quoting it would put quote characters inside the pattern.
- **Windsurf is the same**, and additionally omits `globs` entirely for always-apply.
- **Cline and Claude emit no frontmatter at all** for an always-apply rule — just the
  watermark and the body.

Every generated file has `<!-- @generated by create-code-buddy -->` on its own line
directly after the frontmatter. **A file without it is never touched by the tool**, which
is the whole safety guarantee.

[↑ Back to top](#table-of-contents)

---

## Part 4 — Destructive paths

Scratch directory only.

### Safe clean — **[auto]**

```bash
cd "$(mktemp -d)" && ccb init --yes --agents cursor,claude
printf '# my own rule, no watermark\n' > .cursor/rules/mine.mdc
ccb clean
```

- Multiselect over existing folders, all preselected.
- Preview shows red *"N generated files will be deleted"* and green
  *"N personal files will be skipped"* — the personal count must include `mine.mdc`.
- Decline → yellow `Clean cancelled.`, nothing deleted.
- Accept → `mine.mdc` **survives**; generated files go; `.codebuddy/` untouched.

### Factory reset — **[manual] for the restore**

```bash
ccb clean --hard
```

- Warning banner `⚠️  WARNING: Factory Reset` and three bullets.
- Backup announced as `.codebuddy-backup-<ISO>.tar.gz`.
- **Two** confirmations; the second is red *"Last chance — this cannot be undone."*
- Declining either → `Factory reset cancelled.`, nothing deleted.
- Accepting deletes every agent folder **and `.codebuddy/`**, strips the `.gitignore`
  block (re-adding an ignore for the backup), removes the `AGENTS.md` block, and removes
  the postinstall script if it matches exactly.

**Then actually restore it — nothing automated proves the tarball works:**

```bash
tar -xzf .codebuddy-backup-*.tar.gz && ls -R .codebuddy && ccb sync
```

Your rules must come back and recompile. A backup that cannot be restored is worse than
no backup, because it was trusted.

### Non-TTY guard — **[auto]**

```bash
echo | ccb clean --hard ; echo "exit=$?"
```

Expect exit 1 and: *"clean --hard needs interactive confirmation and stdin is not a TTY.
Re-run with --force to skip the prompts in a non-interactive shell."* It must **hang on
nothing**. Then confirm `--force` actually proceeds.

[↑ Back to top](#table-of-contents)

---

## Part 5 — Do the agents accept it?

**[manual], and this is the part no test can ever replace.** The suite proves we emit
what each vendor documents. Only you can prove the vendor honours it.

Set up one project with all six agents and a scoped rule, then open each tool:

| Agent | Check |
|---|---|
| Cursor | Open a matching file; the rule appears as active context |
| Claude Code | `.claude/rules/` is picked up in a session |
| Cline | Rule applies when editing a matching path |
| Gemini / Antigravity | `.agents/rules/` loads as workspace rules |
| Copilot | `applyTo` scopes the instruction to matching files |
| Windsurf / Devin | `trigger: glob` activates on a match |

Also confirm an **always-apply** rule loads with no file open.

Record the date and version you checked — vendors change formats, and the last time
Windsurf did, we only found out because the docs redirected.

[↑ Back to top](#table-of-contents)

---

## Part 6 — Release checklist

```bash
npm test && npm run typecheck && npm run build
npm pack --dry-run
```

- Tarball contains `dist/` only. `src/`, tests and config must **not** ship.
- Install it somewhere real and drive the actual bin:

```bash
cd "$(mktemp -d)" && npm init -y >/dev/null
npm install /path/to/create-code-buddy-<version>.tgz
npx ccb init --yes --agents cursor && npx ccb sync
```

- Both bin names work: `ccb` and `create-code-buddy`.
- `npx ccb --version` matches `package.json`.
- If postinstall was opted into, it fires on a fresh `npm install` — and **fails
  gracefully offline** rather than breaking the install.

[↑ Back to top](#table-of-contents)

---

## Appendix — expected strings

Exact text, for when you're unsure whether something is a wording change or a bug.

| Situation | Output |
|---|---|
| Init success | `Code Buddy has been configured successfully! 🚀` |
| Init cancelled | `Setup cancelled. No files were created.` (exit **0**) |
| Bad agent id | `Unknown agent id: X.` / `Unknown agent ids: X, Y.` then `Valid agents are: cline, claude, cursor, gemini, copilot, windsurf.` |
| No agents chosen | `⚠  Select at least one agent to continue, or press Ctrl+C to exit at any time.` |
| Sync, per agent | `✔ Compiled N rules → <Label> (<dir>)` |
| Sync, nothing to write | `- No rules to compile → <Label> (<dir>)` (yellow, no tick) |
| Sync, rules left at SSOT root | `⚠ Found N files directly in .codebuddy/ — rules belong in .codebuddy/rules/.` then the filenames, then `Run \`npx create-code-buddy migrate\` to move them.` |
| Sync, deletions | `(removed N stale)` |
| Sync, index | `✔ Indexed rules in AGENTS.md` |
| Unknown SSOT folder | `⚠ Ignoring .codebuddy/X/ — not a recognized folder. Rules belong in .codebuddy/rules/.` |
| Sync, no config | ``No .codebuddy/config.json found. Run `npx create-code-buddy init` first.`` |
| Migrate, nothing to do | `✔ Already using the current layout — nothing to migrate.` |
| Migrate, dry run | `Nothing changed. Re-run with --apply to move them.` |
| Migrate, collision | `Cannot migrate — these already exist at the destination:` |
| Clean, none found | `No compiled agent folders found to clean.` |
| Clean, done | `✔ Cleaned N generated files.` |
| Hard reset, done | `✔ Factory reset complete. N folders deleted.` |

**Markers** — these must never change; files in the wild carry them:

- Watermark: `<!-- @generated by create-code-buddy -->`
- `.gitignore`: `# --- Create Code Buddy (Start) ---` / `(End)`
- `AGENTS.md`: `<!-- create-code-buddy:start -->` / `<!-- create-code-buddy:end -->`

[↑ Back to top](#table-of-contents)
