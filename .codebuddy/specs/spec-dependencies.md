---
description: Whether and how specs should express what blocks them
status: backlog
---

# Spec Dependencies

**This is a thinking document, not a design.** It records a real problem and the
options, so the decision gets made deliberately rather than by whoever implements first.

## The problem, with evidence

`adopt-existing-rules` was blocked for months on a specific technical fact: importing
hand-written rules with the old line-splitting parser would have mangled block-list
YAML. Phase 1 replaced that parser, which unblocked it.

**Nothing in the spec recorded any of that.** Not that it was blocked, not by what, not
that the blocker had cleared. The reason lived in the hardening plan's "out of scope"
section — a different document, which nobody reading the spec would open. It sat at
`planned` the whole time, looking startable, while being unstartable. Then it looked
identical after it became startable.

A status alone cannot express this. `backlog` says "not started" — it cannot say
"cannot be started, because of X" or "X is done now, go".

## What we would want to express

Three different relationships, and it matters that they're different:

1. **Blocked by another spec.** "Don't start this until MCP ships." Internal, and the
   tool can resolve it: the blocker's own status says whether it's cleared.
2. **Blocked by something outside.** A dependency release, a decision, a rebrand you
   haven't made yet. The tool cannot resolve these, only display them.
3. **Ordering without blocking.** "This makes more sense after MCP" — true of
   `branch-aware-specs`, which isn't blocked by MCP at all, just better afterwards.
   Conflating this with real blocking makes everything look stuck.

## Options

**A. A `blocked_by:` field listing spec names.**
Cheap, and the tool can resolve it — if every named spec is `done`, report the spec as
startable. Only expresses relationship 1. External blockers become prose, which is
where they already are.

**B. Free-text `blocked: <reason>`.**
Expresses all three, resolves none. Honest and zero infrastructure, but it rots exactly
the way this problem is about: nobody edits a field to say a blocker cleared, because
nothing prompts them.

**C. Structured `depends_on:` with a kind.**
`{ spec: mcp-integration, kind: blocks | follows }`. Separates real blocking from
ordering, and the tool can compute both. Most capable and most ceremony — a schema for
a repo with four specs.

**D. Don't track it in specs. Use issues.**
GitHub already has blocked-by relationships, and they update when the blocking issue
closes — no hand-editing, no rot. Costs the platform-agnostic property that is the
entire reason this tool exists: an agent reading `.codebuddy/specs/` offline sees nothing.

## The tension

Option D is the honest one for humans, and the wrong one for agents. This tool's whole
premise is that context travels with the repo and needs no network. But dependency
state is the thing most likely to go stale in a file, because it changes when something
*else* happens — which is exactly when nobody is looking at this file.

That asymmetry is the real question here. A `status:` goes stale slowly and visibly.
A `blocked_by:` goes stale silently, the moment the blocker ships.

## Leaning

**A, if anything.** It is the only option where the tool can tell you a blocker cleared
without anyone remembering to edit. `blocked_by: [mcp-integration]` resolves against
that spec's own status, so `sync` can say *"adopt-existing-rules is no longer blocked"*
— which is precisely the sentence nobody got to read for months.

Relationship 3 (ordering) is better served by a "Related" section in prose, which both
`branch-aware-specs` and `mcp-integration` already use, and which costs nothing.

Relationship 2 (external blockers) probably belongs in an issue, per the rule that an
issue tracks what is owed and a spec carries what is known.

## Do not build yet

Four specs is not enough to justify a dependency graph. Revisit when there are enough
that the ordering is genuinely unclear, or the first time a blocker clears and nobody
notices — again.

## Related

- `branch-aware-specs.md` — the other half of giving specs context. If both land, they
  should agree on how frontmatter refers to things outside the file.
