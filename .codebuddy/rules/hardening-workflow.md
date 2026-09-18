---
description: Working agreement carried over from the V1 hardening effort
globs: ["*.*"]
---

# Working Agreement

The V1 hardening effort is **complete** — Phases 1 through 6 shipped in one PR. The
record lives at `docs/V1-HARDENING-PLAN.md`; read it before changing anything under
`src/`, because most of what's there explains why the code is shaped the way it is.

The rules below outlived that effort and still bind.

## Non-negotiables

1. **The test suite is the specification.** Write no new behavior that isn't pinned
   by a test.
2. **A failing golden snapshot is a bug to find, not a snapshot to update.**
   `src/golden.test.ts` holds the exact compiled output of every adapter. When it
   moves, something changed for users — understand what before accepting it, and
   update it in the same commit as the fix it belongs to. Never `vitest -u` to make
   a red suite green.
3. **Never edit a test's expectation to make it pass.** Promoting `it.fails` to `it`
   is the permitted change. Editing an `expect(...)` bends the spec to fit the code.
   *One ratified exception:* `src/sync.test.ts:113` and `:241` were edited when Task
   3.9 resolved in favour of glob passthrough — the first site's own comment
   pre-authorized that exact edit in writing, and the maintainer ratified both. A
   deviation on this rule needs a record like this one; it is not a precedent.
4. **Never change the watermark string** in `src/core/constants.ts`. Files already
   generated in the wild carry it; changing it orphans every one of them. The same
   reasoning covers the AGENTS.md block markers and config keys: old forms stay
   readable, even when they stop being written.
5. **Keep the rule files honest.** Everything in `.codebuddy/rules/` compiles into
   six agent folders and is loaded into agents' context. A rule that describes code
   which no longer exists actively misleads — this file and `codebuddy-system.md`
   both went stale during the restructure and had to be repaired before merge.

## Decisions that are the maintainer's, not yours

Raise them, do not guess. Resolved so far:

- **Glob prefixing (3.9)** — ✅ passthrough. Cline's docs (2026-09-17) say `paths`
  are matched as written; the prefix was this adapter's own invention.
- **Windsurf frontmatter (3.10)** — ✅ `trigger: always_on | glob`. docs.windsurf.com
  redirects to docs.devin.ai; `.windsurf/rules/` is the documented fallback.
  **Still open:** whether to also target `.devin/rules/`, or rename the adapter id.
- **`postinstall` vs `prepare` (3.7)** — still open, deliberately. The `--yes`
  consent bug was fixed without touching it.

## Before committing

```bash
npm test && npm run typecheck && npm run build
```

## Before opening a PR

**If behaviour changed, `docs/QA.md` changes in the same PR.** A new flag, a new
command, different output text, a different file layout — each has a scenario in there
that is now wrong, and a QA doc that lies is worse than none, because it trains the
tester to skip mismatches.

Check: does any scenario, expected-output string, or the appendix table still describe
what the code did before your change? Fix it here, not later.

If the change adds behaviour a test cannot reach — anything interactive, anything about
rendering, anything only a real install exercises — add a `[manual]` scenario for it.

## On phasing

The plan called for one phase per branch. In practice Phases 1-6 shipped as a single
PR, because the phases interlock: Phase 1's test harness is what made Phase 2's
refactor safe, and Phase 2's adapter registry is what made Phase 6 a path change
rather than six parallel edits. Reviewing any later phase against a `main` without
the earlier ones would mean reviewing it against code that didn't exist.

That was a deliberate, recorded trade against reviewability. Prefer smaller PRs now
that the foundation is in.
