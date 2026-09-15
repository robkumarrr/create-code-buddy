# V1 Hardening Plan

**Status:** ready to execute · **Created:** 2026-09-15 · **Scope:** correctness + architecture only

This plan takes `create-code-buddy` from "works in the happy path" to "launch-ready."
It is written to be executed by a coding agent with minimal supervision. Every task
states what to change, what proves it, and what "done" means.

**The rename to Hivemind is parked.** Do not rename anything. Task 4.5 makes a future
rename a one-line change instead of a 54-site find-and-replace.

---

## Handoff readiness

Phase 1 is complete and every subsequent phase has an executable spec. **98 tests: 79
passing, 19 `it.fails` carrying the specification for Phases 2 and 3.**

| Phase 3 task | Pinned by |
|---|---|
| 3.1 Copilot `applyTo` | `sync.test.ts` — applyTo is one comma-joined string |
| 3.2 Cursor `globs` / `alwaysApply` | `sync.test.ts` — bare comma form, alwaysApply emitted |
| 3.3 Deselected agents | `sync.test.ts` — compiled folder removed on next sync |
| 3.4 Scoped `.gitignore` | `sync.test.ts` — `.claude/rules/`, never `.claude/` |
| 3.5 Exit codes | `cli.test.ts` — real subprocess exit status |
| 3.6 Unknown agent ids | `cli.test.ts` — rejected, offending id named |
| 3.7 `--yes` postinstall consent | `cli.test.ts` — default off, `--postinstall` opts in |
| 3.8 Hard-clean backup | `clean.test.ts` — ignore entry survives and matches |
| 3.11 Gemini skill | `sync.test.ts` — SKILL.md emitted, legacy orphans collected |

Tasks 3.9 (glob prefixing) and 3.10 (Windsurf format) are deliberately unspecified —
they are maintainer decisions, flagged in the plan and in the tests. An executing agent
should raise them, not guess.

**The handoff package is this document plus the test suite on
`hardening/phase-1-foundation`.** The plan alone is not sufficient; the tests are the
part that cannot be misread.

---

## 0. Rules of engagement (read first)

1. **Test-first, always.** Every task below names its test. Write the failing test,
   then make it pass. The test suite *is* the specification — if a test and this
   document disagree, stop and ask.
2. **One phase per branch.** Branch from `main` as `hardening/phase-N-<slug>`. Do not
   combine phases in one PR; Phase 2 is a large refactor and must be reviewable alone.
3. **`npm test` must be green before every commit.** No exceptions, no `.skip`.
4. **Do not change observable CLI behavior except where a task explicitly says to.**
   Phase 2 in particular is a pure refactor: identical bytes out, different code in,
   enforced by the golden snapshot in `src/golden.test.ts`. Never run `vitest -u`
   during Phase 2.
5. **Stop at each CHECKPOINT** and hand back for review. Do not proceed past one.
6. **No new runtime dependencies** beyond the single one named in Task 1.1.

---

## 1. Verified format reference

This table is **ground truth**, verified on 2026-09-15 against each agent's documented
format and the output conventions established across the ecosystem. Where our current
output differs, our output is the one that is wrong. Encode this table in the adapters.

| Agent | Output path | Frontmatter written |
|---|---|---|
| **Cursor** | `.cursor/rules/<name>.mdc` | `description: <text>`<br>`globs: a,b,c` ← **bare, comma-joined, NOT quoted, NOT a YAML array** |
| **Copilot** | `.github/instructions/<name>.instructions.md` | `description: <text>`<br>`applyTo: 'a,b,c'` ← **one single-quoted comma-joined string** |
| **Cline** | `.clinerules/<name>.md` | `paths:` YAML block list, then `description: <text>` |
| **Claude Code** | `.claude/rules/<name>.md` | `paths:` YAML block list (no description) |
| **Gemini** | `.agents/rules/<name>.md` | passthrough of normalized frontmatter |
| **Windsurf** | `.windsurf/rules/<name>.md` | passthrough — **see Task 3.10, needs verification** |

Notes captured during verification:

- Our current Copilot output, `applyTo: "*.ts", "*.js"`, is **not valid YAML** — it
  fails to parse with `Unexpected scalar at node end`. This is the highest-severity
  format bug.
- Our current Cursor output uses a YAML array. That parses, but the established
  convention is the bare comma form, which is what Cursor's own docs show. Match it.
- **Cursor is the one adapter exempt from the valid-YAML rule.** Its `.mdc` frontmatter
  is deliberately not strict YAML: `globs: *.ts` is an unresolved alias to a YAML
  parser, and `globs: **/*` likewise. Cursor reads it with its own lenient parser.
  Verified 2026-09-15. Do **not** "fix" this by quoting the globs — the quotes end up
  inside the pattern and glob matching breaks. Its test asserts on the exact string
  instead of calling `readFrontmatter`.
- `.claude/rules/` **is** a real target, so our choice here is sound. Claude Code
  also reads `CLAUDE.md`; see Phase 5.
- The prevailing convention passes globs through **verbatim**, with no `**/` prefix.
  We currently add `**/` for Cline only. See Task 3.9 — this is an open decision,
  not a bug to silently "fix."

---

## PHASE 1 — Foundation ✅ COMPLETE

Landed on `hardening/phase-1-foundation`. 82 tests: 73 passing, 9 `it.fails` carrying
the Phase 2/3 spec. `sync.ts` coverage went from 84% statements / 58% branches to
97.6% / 84.7%; `clean.ts` from 72% / 67% to 92% / 85%.

**Three findings from execution, already folded in below:**

1. Two behaviors assumed broken were already correct, and are now regression guards
   rather than `it.fails`: a deselected agent *does* lose its `.gitignore` entry (it is
   the compiled files that linger, which is what makes it dangerous), and a malformed
   rule *does not* abort the run today — that test now guards the new YAML parser
   against regressing it.
2. Cursor's format is not strict YAML. See the format reference note.
3. The build was shipping test files and stale dead code (`dist/add-rule.js`, from a
   feature deleted long ago), and `dist/test/workspace.js` required `vitest`, a
   devDependency. Fixed with a separate `tsconfig.build.json` plus `rm -rf dist` in the
   build script; `npm run typecheck` still checks tests. Package went from 17 emitted
   files to 11.

**Goal:** a real rule model, a real YAML parser, and a test harness that touches a
real filesystem. Everything after this phase depends on it.

**Why first:** every bug in the audit survived a green test suite, because
`vi.mock('fs')` makes `existsSync` return one global value for an entire test. The
mock cannot express "this file exists but that one doesn't," which is exactly the
condition every one of these bugs lives in.

### Task 1.1 — Dependencies

- Add `yaml` (^2) to `dependencies`.
- Remove `ejs` and `@types/ejs`. They are imported nowhere; confirm with
  `grep -rn "ejs" src/` returning nothing before removing.
- In `package.json`, fix `"files": ["dist", "templates"]` → `["dist"]`. There is no
  `templates` directory.

### Task 1.2 — `src/core/constants.ts`

Single home for values currently duplicated across files:

```ts
export const SSOT_DIR = '.codebuddy';
export const CONFIG_FILE = 'config.json';
export const TOOL_NAME = 'create-code-buddy';
export const WATERMARK = `<!-- @generated by ${TOOL_NAME} -->`;
export const GITIGNORE_START = `# --- Create Code Buddy (Start) ---`;
export const GITIGNORE_END = `# --- Create Code Buddy (End) ---`;
```

Replace the two `WATERMARK` definitions (`src/sync.ts:95`, `src/clean.ts:7`) and every
literal `.codebuddy` string with imports from here.

> **Do not change the watermark text.** Files already generated in the wild carry the
> current string; changing it would make every one of them invisible to `clean` and to
> the stale-file collector, and they would be orphaned on users' disks forever.

### Task 1.3 — `src/core/rule.ts` — the rule model

This is the heart of the refactor. One normalized shape that every adapter renders from.

```ts
export interface Rule {
  /** Path relative to .codebuddy, e.g. 'backend/database.md' */
  relPath: string;
  description: string;
  /** ALWAYS a normalized array. Empty array means "applies everywhere". */
  globs: string[];
  /** True when the rule should always be in context (no glob targeting). */
  alwaysApply: boolean;
  /** Frontmatter keys we don't model, preserved for passthrough adapters. */
  extra: Record<string, unknown>;
  body: string;
}
```

Export three pure functions, all unit-tested:

**`parseRule(relPath: string, raw: string): Rule`**

- Split frontmatter with the existing regex (it already handles CRLF — keep that).
- Parse the frontmatter block with `YAML.parse`, **not** by splitting on `:`.
- On a YAML parse error: do not throw and do not crash the whole sync. Return the rule
  with empty frontmatter, and record a warning the caller can surface. One bad file
  must not take down the run.
- `description` defaults to `'Code Buddy Rule'`.
- `alwaysApply` is true when frontmatter says so explicitly, **or** when `globs`
  normalizes to `[]` or to exactly `['*.*']`.
- Every frontmatter key other than `description`, `globs`, and `alwaysApply` goes into
  `extra` unchanged.

**`normalizeGlobs(input: unknown): string[]`** — must accept all five of these and
produce the same array:

| Input form | Example |
|---|---|
| YAML array | `globs: ["*.ts", "*.js"]` |
| YAML block list | `globs:`<br>`  - "*.ts"`<br>`  - "*.js"` |
| Bare comma string | `globs: *.ts,*.js` |
| Quoted comma string | `globs: "*.ts", "*.js"` |
| Single string | `globs: "*.ts"` |

Strip surrounding quotes and whitespace from each entry; drop empties.

> The YAML block-list form is the one a human most naturally hand-writes, and it is
> currently parsed as an empty string — which silently turns a targeted rule into an
> always-on rule applied to every file. Fixing this is the single highest-value change
> in Phase 1.

**`renderFrontmatter(obj: Record<string, unknown>): string`** — serialize with
`YAML.stringify`, so we can never again emit invalid YAML by string concatenation.
Adapters that need a non-YAML form (Cursor's bare `globs:`) build that one line by
hand and are covered by an explicit test.

### Task 1.4 — `src/core/fs.ts`

Move the canonical `getMarkdownFiles` here, in the `{ abs, rel }` form from
`src/sync.ts:20`. Delete the two divergent copies in `src/list.ts:8` and
`src/clean.ts:18` and import this instead. Move `pruneEmptyDirs` here too.

### Task 1.5 — `src/test/workspace.ts` — the harness

```ts
/** Creates a real temp dir. Register cleanup in afterEach. */
export function makeWorkspace(files?: Record<string, string>): string;
/** Writes a .codebuddy/config.json plus any rule files. */
export function seedProject(root: string, opts: {
  agents: string[];
  gitignore?: boolean;
  rules?: Record<string, string>;
}): void;
/** Reads a generated file and asserts its frontmatter is parseable YAML.
 *  Returns the parsed object so tests can assert on values. */
export function readFrontmatter(absPath: string): Record<string, unknown>;
/** Lists every file under a dir, relative, sorted — for exact-tree assertions. */
export function tree(root: string): string[];
```

Use `fs.mkdtempSync(path.join(os.tmpdir(), 'ccb-'))`. Clean up in `afterEach`.

### Task 1.6 — Rewrite the compiler tests as integration tests

Delete `vi.mock('fs')` from `src/sync.test.ts` and `src/clean.test.ts` entirely.
Rewrite against `makeWorkspace`. Keep mocking `@clack/prompts` (interactive) and
`picocolors` (noise) — those are fine to mock.

**Every adapter test must call `readFrontmatter` on its output.** That single
assertion is what catches the invalid-YAML class of bug, permanently.

Required new test cases — these are the executable spec for Phase 3, and most
**fail until Phase 3 lands**. That is intended, and it is handled with vitest's
`it.fails`, never by leaving the branch red.

`it.fails` asserts that a test *currently* fails, so the suite stays green. The moment
the underlying bug is fixed, the marker itself starts failing, forcing whoever fixed it
to promote the test to a plain `it`. This keeps "green suite" a trustworthy signal for
the whole refactor — critical, because a permanently-red branch makes it impossible to
tell an expected failure from something you just broke. Never delete one to get green.

| Test | Asserts |
|---|---|
| `multi-glob rule produces valid YAML for every adapter` | `readFrontmatter` succeeds on all six outputs |
| `copilot applyTo is a single comma-joined string` | `applyTo === '*.ts,*.js'` |
| `cursor globs is the bare comma form` | raw line is `globs: *.ts,*.js` |
| `YAML block-list globs survive the round trip` | rule is targeted, not always-on |
| `alwaysApply: true is preserved for cursor` | key present in output |
| `deselecting an agent removes its compiled folder` | `.clinerules` gone after re-sync without cline |
| `deselecting an agent removes its gitignore entry` | and leaves no orphan files behind |
| `gitignore entries are scoped to rules dirs` | `.claude/rules/` not `.claude/` |
| `hand-written file without watermark is never deleted` | regression guard on the core safety property |
| `deleted SSOT rule is garbage collected` | regression guard (works today — keep it working) |
| `sync with no config sets exit code 1` | `process.exitCode === 1` |
| `unknown agent id is rejected` | non-zero exit, names the bad id |
| `malformed YAML in one rule does not abort the run` | other rules still compile |

### ⛔ CHECKPOINT 1

Stop. Hand back for review. **The tests are the specification for everything that
follows** — a wrong test here becomes a wrong implementation in three phases' time.
Review the test suite, not just the fact that it runs.

---

## PHASE 2 — Adapter registry

**Goal:** collapse six near-identical `if (agent === '...')` blocks
(`src/sync.ts:122-270`, ~85% duplicated) into one interface plus six small modules.

**This is a pure refactor.** Generated bytes must not change. Phase 1's tests are the
proof: they were green at CHECKPOINT 1 for current behavior, and they must still be
green at CHECKPOINT 2. Fix formats in Phase 3, not here.

### Task 2.1 — `src/adapters/types.ts`

```ts
import type { Rule } from '../core/rule';

export interface AgentAdapter {
  /** Stable id used in config.json and --agents. */
  id: string;
  /** Human label for prompts, e.g. 'Claude Code'. */
  label: string;
  /** Where compiled rules live, relative to project root. */
  rulesDir: string;
  /** Exact paths to write into .gitignore. MUST be scoped to generated
   *  output — '.claude/rules/', never '.claude/'. See Task 3.4. */
  ignorePaths: string[];
  /** Output filename for a rule, relative to rulesDir.
   *  e.g. 'backend/db.md' -> 'backend/db.mdc' */
  outputPath(rule: Rule): string;
  /** The full file contents, watermark included. */
  render(rule: Rule): string;
  /** Optional non-rule files, e.g. Gemini's SKILL.md. Paths are
   *  relative to project root. Watermarked, and garbage-collected
   *  like any other generated file. */
  extraFiles?(rules: Rule[]): { path: string; content: string }[];
}
```

### Task 2.2 — One module per agent

`src/adapters/{cursor,copilot,cline,claude,gemini,windsurf}.ts`, each a default-exported
`AgentAdapter`. Port the logic from the corresponding block in `sync.ts` **verbatim**
in this phase.

### Task 2.3 — `src/adapters/index.ts`

```ts
export const ADAPTERS: AgentAdapter[] = [ /* all six */ ];
export const ADAPTER_IDS = ADAPTERS.map(a => a.id);
export function getAdapter(id: string): AgentAdapter | undefined;
```

### Task 2.4 — Rewrite `syncAgents` as a loop

```
for (const adapter of ADAPTERS) {          // ALL adapters, not just active ones
  const active = config.agents.includes(adapter.id);
  const expected = active ? new Set(outputPaths) : new Set();  // empty ⇒ GC everything
  cleanStaleRules(adapter.rulesDir, expected);
  if (!active) continue;
  ...write files, collect ignorePaths...
}
```

Iterating **all** adapters with an empty expected-set for inactive ones is what fixes
the deselect bug (Task 3.3) for free, and it is self-healing even if someone hand-edits
`config.json`. It needs no extra state in the config file.

### Task 2.5 — Derive the other two lists from the registry

- `src/clean.ts:9` `AGENT_FOLDERS` — delete the hand-maintained array, derive from
  `ADAPTERS`. It has already drifted from `sync.ts` once.
- `src/prompts.ts:42` multiselect options — derive from `ADAPTERS` too.

After this, adding a seventh agent is one new file plus one line in `index.ts`.

### Task 2.6 — Acceptance gate (objective, not a judgment call)

Phase 2 claims "identical bytes out, different code in." That claim is machine-checkable,
so check it by machine rather than by reading the diff. All five must hold:

| # | Gate | Command |
|---|---|---|
| 1 | Full suite green | `npm test` |
| 2 | Golden snapshot **unchanged** | included in `npm test` — see below |
| 3 | Types clean | `npm run typecheck` |
| 4 | No test expectation edited | `git diff main -- 'src/**/*.test.ts'` |
| 5 | Package still builds clean | `npm run build` |

**Gate 2 is the load-bearing one.** `src/golden.test.ts` snapshots the complete compiled
output for all six adapters against a fixture covering multi-glob, single-glob,
universal, nested, no-frontmatter and horizontal-rule-in-body cases. A one-word change
inside a single adapter fails it with an exact diff of every affected file.

> **`vitest -u` is forbidden for the whole of Phase 2.** If the snapshot fails, the
> refactor changed behavior. That is a bug to find, never a snapshot to update. In
> Phase 3 the snapshot is *expected* to move, and it should be updated in the same
> commit as each fix, so the diff becomes a reviewable record of exactly which bytes
> that fix changed.

On gate 4, the only permitted change to a test file is promoting an `it.fails` to a
plain `it`. An edited `expect(...)` means the implementation was bent to fit the code
rather than the code to fit the spec — stop and escalate.

### ⛔ CHECKPOINT 2

Stop. Confirm all five gates pass and that the interface landed as designed. If any
test expectation was edited, the refactor changed behavior — find out why before
proceeding.

---

## PHASE 3 — Correctness

Every task here has a test already written in Phase 1. Turn them green one at a time.

### 3.1 — Copilot `applyTo` *(highest severity)*
`src/sync.ts:206`. Emit `applyTo: '<globs joined by comma>'` — one single-quoted
string. Currently emits `applyTo: "*.ts", "*.js"`, which is invalid YAML, so two of
the four baseline rules we ship are broken on install.

### 3.2 — Cursor `globs`
Emit the bare comma-joined form: `globs: *.ts,*.js`. Also emit `alwaysApply: true`
when `rule.alwaysApply` — we currently drop that key entirely.

### 3.3 — Deselected agents
Already fixed by Task 2.4's loop. Confirm the test is green: after re-syncing without
`cline`, `.clinerules/` is gone **and** its `.gitignore` line is gone, with no orphans.
Today the files survive *and* become newly visible to git, so stale generated rules get
committed as if hand-authored — the exact failure the tool exists to prevent.

### 3.4 — Scope the `.gitignore` paths
`ignorePaths` becomes `.cursor/rules/`, `.claude/rules/`, `.windsurf/rules/`,
`.agents/rules/`, `.clinerules/`, `.github/instructions/`.

Today we ignore `.cursor/`, `.claude/` and `.windsurf/` wholesale, which silently stops
tracking the user's own `.claude/settings.json`, custom commands, skills, and
`.cursor/mcp.json`. Copilot's entry is already correctly scoped — match it everywhere.

**Migration:** `updateGitignore` rewrites the whole marked block each run, so existing
users get the corrected paths automatically on their next sync. No upgrade step needed.

### 3.5 — Exit codes
Add `src/core/report.ts`:

```ts
export function fail(msg: string): void {   // prints red, sets exit code, does NOT throw
  console.error(pc.red(msg));
  process.exitCode = 1;
}
```

Use `process.exitCode`, not `process.exit()`, so stdout flushes first. Apply at
`src/sync.ts:113` and every other error path. Then fix `src/index.ts:115`:

```ts
main().catch(err => { console.error(err); process.exit(1); });
```

Today every failure path exits 0, so nothing is detectable in CI — which matters
because we recommend a postinstall hook.

### 3.6 — Validate agent ids
In `init`, reject ids not in `ADAPTER_IDS`: print the bad id and the valid list, exit 1.
Today `init --yes --agents notanagent` prints "configured successfully! 🚀", writes the
config, compiles nothing, and exits 0. Our own `codebuddy-system.md` instructs agents to
pass `--agents`, so a typo is currently invisible to the agent that made it.

### 3.7 — `--yes` must not silently edit `package.json`
`src/prompts.ts:25` forces `addPostinstall: true` whenever a `package.json` exists, with
no way to decline from flags. An agent following our own instructions mutates the user's
`package.json` without consent.

- Default `addPostinstall` to **false** under `--yes`.
- Add explicit `--postinstall` / `--no-postinstall` flags.
- Interactive behavior is unchanged.

Also reconsider the script itself: `npx create-code-buddy sync` on `postinstall` runs on
every `npm ci`, hits the network, and fails offline. Recommend a `prepare` script with
the tool as a devDependency. **Flag this for the maintainer — do not change the default
without a decision.**

### 3.8 — Hard-clean backup bugs
`src/clean.ts` has two:
1. Line 78 adds `*.codebuddy-backup.tar.gz` to `.gitignore`; line 100 then strips the
   entire block, deleting it again.
2. That pattern never matched anyway — backups are named
   `.codebuddy-backup-<timestamp>.tar.gz`, so the glob needs to be
   `.codebuddy-backup-*.tar.gz`.

Fix the ordering (write the backup entry *after* the block is rebuilt) and the pattern.

Separately: `clean --hard` uses two `confirm()` prompts, which hang on non-TTY stdin.
Add a `--force` flag (a non-TTY run without `--force` should fail with a clear message
rather than hang).

### 3.9 — Decide: glob `**/` prefixing *(maintainer decision — do not guess)*
`src/sync.ts:263` rewrites `*.test.ts` → `**/*.test.ts` for Cline only. The prevailing
convention is to pass globs through verbatim everywhere. Options: (a) pass through,
(b) prefix consistently for every adapter, (c) keep the inconsistency.

**Recommendation: (a).** Silently rewriting the user's stated intent is surprising, and
the behavior currently differs per adapter for no documented reason. Surface a warning
later in a `doctor` command instead.

### 3.10 — Verify Windsurf's current format *(research task)*
Notably, tooling elsewhere in the ecosystem has **dropped rules support for Windsurf
altogether**, which suggests the format moved. Our adapter
passes `description`/`globs` straight through, which Windsurf may well ignore, making
those rules silently inert.

Check current Windsurf docs for the real frontmatter (last known: a `trigger:` key with
values like `always_on` / `glob`, alongside `globs:`). Update the adapter, or if it can't
be verified, say so in the README rather than implying it works.

### 3.11 — Restore the Gemini skill
Commit `515aaa3` shipped `codebuddy-system.md` as a native Gemini Skill; the
`.agents/rules/` refactor in `1fcc7cb` silently dropped it. The orphan is still in this
repo at `.agents/skills/codebuddy-system/SKILL.md`, along with three stale `.agents/*.md`
files that the collector can no longer see because it only scans `.agents/rules/` now.

Restore it via the `extraFiles` hook from Task 2.1, **with a test this time.** Also have
the Gemini adapter collect stale files from the legacy locations so existing users'
orphans get cleaned up.

---

## PHASE 4 — Hygiene

### 4.1 — Coverage gate
`vitest.config.ts` currently omits `all: true`, so `add.ts` (137 lines) and `index.ts`
(115 lines) are untested *and invisible in the report*. Add:

```ts
coverage: {
  all: true,
  include: ['src/**/*.ts'],
  exclude: ['src/**/*.test.ts', 'src/test/**'],
  thresholds: { statements: 85, branches: 75, functions: 90, lines: 85 },
}
```

Start the thresholds at whatever the real number is after Phase 3 and ratchet up. CI
already runs `test:coverage`, so the gate enforces itself.

### 4.2 — Cover `add.ts`
It has zero tests and is the command agents are told to call. Integration-test the
non-interactive path: nested names (`backend/database`), glob quoting, the
missing-`.codebuddy` error, and that it triggers a sync.

### 4.3 — Rewrite `AGENTS.md`
It describes a CLI that no longer exists: `--framework`, `--agent`, `--options`,
`add-rule`, EJS templates, an `agent-config/` folder. It also claims "100% unit test
coverage," which was never true. Rewrite it against the actual commands.

### 4.4 — README accuracy
- Gemini is listed as `.agents/*.md`; it is `.agents/rules/*.md`.
- Add a "what it does not do yet" section. Under-promising is cheap; a bug report from
  someone who believed the README is not.

### 4.5 — Pre-stage the rename without doing it
Route every user-visible string through `TOOL_NAME`/`SSOT_DIR` from Task 1.2. This turns
a future rename into editing two constants plus a migration for the watermark, instead of
the 54 hardcoded sites there are today. **Do not rename anything now.**

---

## PHASE 5 — `AGENTS.md` + `CLAUDE.md` adapters

Deliberately last: it is a new capability, and it should sit on a foundation that works.

`AGENTS.md` and `CLAUDE.md` at the repo root are first-class targets elsewhere in the
ecosystem, and we write neither. AGENTS.md is becoming the cross-agent convention, which
cuts both ways — it erodes the "compile to six formats" pitch, *and* it makes us the
tool that generates it. Being the last SSOT tool without an AGENTS.md emitter is the
worst of both.

Build as two more adapters:
- `agentsmd` → root `AGENTS.md`, rules concatenated under `##` headings.
- `claudemd` → root `CLAUDE.md`, same shape.

Both need care the others don't: these files are **frequently hand-edited**, and the
`.claude/rules/` adapter may already cover Claude Code. Use a watermarked
managed block (same start/end marker pattern as `updateGitignore`) so hand-written
content above and below survives a sync. Do not clobber a whole file we did not create.

---

## Out of scope — parked deliberately

- **The Hivemind rename.** Parked. Task 4.5 makes it cheap later.
- **`import` / adopt-existing-rules.** Good feature, wrong order: importing hand-written
  rules with the current parser would mangle exactly the block-list YAML from Task 1.3.
  Ship after Phase 1. Add a dry-run preview when you do.
- **MCP server.** Strategically the most interesting direction and worth a real design
  session. Comparable tooling already ships an MCP server, so this needs a sharper
  angle than "we have one too." Not a hardening task.
- **`doctor` / `--check` drift detection.** Genuinely valuable for teams that commit
  compiled output, and cheap once Phase 2 lands. First thing after this plan.

---

## Suggested execution order

| Phase | Content | Risk | Checkpoint |
|---|---|---|---|
| 1 | Foundation: model, YAML, harness, spec tests | Med — decisions ripple | ⛔ **review the tests** |
| 2 | Adapter registry refactor | Med — wide but test-guarded | ⛔ **review the interface** |
| 3 | Correctness fixes | Low — each has a failing test | — |
| 4 | Hygiene, docs, coverage gate | Low | — |
| 5 | AGENTS.md / CLAUDE.md adapters | Low–med — new capability | — |

**Definition of done for the whole plan:** `npm test` green, coverage gate passing, and
a clean-room run of `init → add → sync → deselect an agent → sync → clean` producing
valid YAML at every step with no orphaned files.
