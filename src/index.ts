#!/usr/bin/env node

import { intro, outro } from '@clack/prompts';
import pc from 'picocolors';
import { program } from 'commander';
import { runPrompts } from './prompts';
import { generateConfig } from './generator';
import { addRule } from './add-rule';

async function main() {
  program
    .name('create-code-buddy')
    .description('A CLI tool to scaffold agentic context and rules.')
    .version('1.0.0');

  program
    .command('init', { isDefault: true })
    .description('Initialize the code buddy interactive wizard')
    .option('-M, --disable-minimizer', 'Disable automatic token minimization (globs/progressive disclosure)')
    .option('-y, --yes', 'Skip all prompts and use default or provided values (useful for AI agents)')
    .option('-f, --framework <name>', 'The framework to use (e.g. laravel, nextjs)')
    .option('-a, --agent <name>', 'The agent to use (e.g. cursor, gemini)')
    .option('-o, --options <json>', 'JSON string of framework specific options')
    .action(async (cliOptions) => {
      console.clear();
      intro(pc.bgCyan(pc.black(' create-code-buddy ')));

      let parsedOptions = {};
      if (cliOptions.options) {
        try {
          parsedOptions = JSON.parse(cliOptions.options);
        } catch (e) {
          console.warn(pc.yellow('Failed to parse --options JSON string. Ignoring.'));
        }
      }

      const answers = await runPrompts({
        yes: cliOptions.yes,
        framework: cliOptions.framework,
        agent: cliOptions.agent,
        options: parsedOptions
      });

      if (!answers) {
        outro(pc.yellow('Setup cancelled. No files were created.'));
        process.exit(0);
      }

      await generateConfig(answers, process.cwd(), cliOptions.disableMinimizer);
      outro(pc.green('Your code buddy context has been generated successfully! 🚀'));
    });

  program
    .command('add-rule <name>')
    .description('Scaffold a new rule template dynamically')
    .action(async (name) => {
      await addRule(name, process.cwd());
    });

  program.parse(process.argv);
}

main().catch(console.error);
