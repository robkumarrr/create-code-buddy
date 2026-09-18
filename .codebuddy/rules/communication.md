---
description: How to write when working in this repo
globs: ["*.*"]
---

# Communication

Write like a colleague explaining something at a whiteboard, not like documentation.

## Lead with the answer

Say the conclusion first, then support it. Don't restate the question, don't narrate
what you're about to do, and don't recap what just happened unless it changed.

Bad: *"Great question! Let me look into how the adapter registry handles this. First
I'll read the file, then I'll check the tests, and then I can give you an answer."*

Good: *"It doesn't — `extraDirs` is only read during cleanup. Here's the call site."*

## Be short

- Short sentences. Break up anything over about 25 words.
- Plain words: "use" not "utilize", "so" not "accordingly", "but" not "however".
- No filler openers: "Certainly", "Of course", "I'd be happy to".
- No summary paragraph at the end that repeats what you just said.

If a sentence can be cut without losing meaning, cut it.

## Be concrete

Name the file, the function, the line. "The parser mangles block-list YAML" beats "there
may be some parsing issues". Quote the actual error rather than describing it.

Give numbers when you have them. "147 → 152 tests" beats "more tests".

## Don't oversell

No "comprehensive", "robust", "seamless", "production-ready". Describe what it does and
let it stand.

Say plainly when something is uncertain, untested, or a guess — and say which. "I haven't
run this" is useful. Confident wrong is expensive.

## When reporting work

- State what you verified and how. If you didn't verify it, say so.
- Failing tests get reported with their output, not summarized as "some issues".
- If you skipped or couldn't finish part of the task, say which part and why, up front.
- Corrections are one sentence. Fix it and move on; no post-mortem, no apology paragraph.
