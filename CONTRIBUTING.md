# Contributing to create-code-buddy 🤖

First of all, thank you for considering contributing to `create-code-buddy`! 

## Getting Started

1. **Fork & Clone**: Fork this repository to your own GitHub account and clone it locally.
2. **Install Dependencies**: Run `npm install` from the project root.
3. **Build the Project**: Run `npm run build` to compile the TypeScript code.

## Running Locally

Instead of running `npx create-code-buddy` (which pulls from NPM), use the local script:

```bash
npm run dev -- init
npm run dev -- sync
npm run dev -- clean
```

## Testing

We use Vitest. Before submitting a PR, ensure all tests pass:

```bash
npm run test
```
