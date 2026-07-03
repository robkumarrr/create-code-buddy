#!/usr/bin/env node

import { intro, outro, text, select, confirm, isCancel } from '@clack/prompts';
import pc from 'picocolors';
import { runPrompts } from './prompts';
import { generateConfig } from './generator';

async function main() {
  console.clear();
  intro(pc.bgCyan(pc.black(' create-code-buddy ')));

  // Run the interactive wizard
  const answers = await runPrompts();

  // If the user cancelled at any point
  if (!answers) {
    outro(pc.yellow('Setup cancelled. No files were created.'));
    process.exit(0);
  }

  await generateConfig(answers);

  outro(pc.green('Your code buddy context has been generated successfully! 🚀'));
}

main().catch(console.error);
