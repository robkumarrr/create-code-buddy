---
description: Working agreement for the V1 hardening effort
globs: ["*.*"]
---

# V1 Hardening: Working Agreement

An active hardening effort governs changes to this repo. The full plan lives at
`docs/V1-HARDENING-PLAN.md` — **read it before changing anything under `src/`.**

## Non-negotiables

1. **The test suite is the specification.** Every planned fix already has a test
   describing it. Write no new behavior that isn't pinned by one.
2. **Never run `vitest -u` during the Phase 2 refactor.** `src/golden.test.ts`
   snapshots the exact compiled output of every adapter. Phase 2 claims "identical
   bytes out, different code in" — a failing snapshot means the refactor changed
   behavior. That is a bug to find, never a snapshot to update. From Phase 3 on,
   update it in the same commit as the fix it belongs to.
3. **Never edit a test's expectation to make it pass.** The only permitted change
   to a test is promoting `it.fails` to `it` once the underlying bug is fixed.
   Editing an `expect(...)` means the spec is being bent to fit the code.
4. **Stop at the checkpoints.** The plan marks them ⛔. Hand back rather than
   pressing on.
5. **Never change the watermark string** in `src/core/constants.ts`. Files already
   generated in the wild carry it; changing it orphans every one of them.

## Rules that are the maintainer's call, not yours

The plan flags these explicitly. Raise them, do not guess:

- Whether to prefix globs with `**/` (task 3.9)
- Windsurf's current frontmatter format (task 3.10)
- Whether `postinstall` should become `prepare` (task 3.7)

## Before committing

```bash
npm test && npm run typecheck && npm run build
```
