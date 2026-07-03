# create-code-buddy

You are assisting in the development of `create-code-buddy`, a lightning-fast TypeScript CLI tool built with `@clack/prompts`.

## Core Directives
1. **TypeScript Strictness**: We use strict TypeScript. Avoid `any` types. Prefer interfaces and explicitly typed function signatures.
2. **Architecture**: 
   - `src/index.ts` is the entry point.
   - `src/prompts.ts` handles UI.
   - `src/generator.ts` handles the filesystem generation.
3. **Immutability**: Prefer pure functions where possible. 

## Workflow
- When asked to plan a feature, generate a spec in the `.gemini/specs/` folder following the `spec.md` template before writing code.
