#!/usr/bin/env node

import { intro, outro } from '@clack/prompts';
import pc from 'picocolors';
import { program } from 'commander';
import { runPrompts } from './prompts';
import { generateConfig } from './generator';
import { addEntry } from './add';
import { listRules } from './list';
import { syncAgents } from './sync';
import { cleanAgents } from './clean';

async function main() {
  program
    .name('create-code-buddy')
    .description('A CLI tool to compile and manage agentic context and rules.')
    .version('1.0.0');

  program
    .command('init', { isDefault: true })
    .description('Initialize the Code Buddy SSOT and config')
    .option('-y, --yes', 'Skip all prompts and use defaults (useful for AI agents)')
    .option('-a, --agents <names>', 'Comma-separated list of agents (e.g. cursor,gemini,copilot)')
    .option('--no-gitignore', 'Do not add compiled folders to .gitignore')
    .action(async (cliOptions) => {
      console.clear();
      intro(pc.bgCyan(pc.black(' create-code-buddy ')));

      let parsedAgents;
      if (cliOptions.agents) {
        parsedAgents = cliOptions.agents.split(',').map((a: string) => a.trim());
      }

      const answers = await runPrompts({
        yes: cliOptions.yes,
        agents: parsedAgents,
        addToGitignore: cliOptions.gitignore !== false
      });

      if (!answers) {
        outro(pc.yellow('Setup cancelled. No files were created.'));
        process.exit(0);
      }

      await generateConfig(answers, process.cwd());
      outro(pc.green('Your Code Buddy SSOT has been generated successfully! 🚀'));
    });

  program
    .command('sync')
    .description('Compile the SSOT markdown rules into agent-specific folders')
    .action(async () => {
      await syncAgents(process.cwd());
    });

  program
    .command('clean')
    .description('Remove compiled agent folders and clean up .gitignore')
    .action(async () => {
      await cleanAgents(process.cwd());
    });

  program
    .command('add')
    .description('Interactively add a new directory or rule entry')
    .action(async () => {
      await addEntry(process.cwd());
    });

  program
    .command('list')
    .description('Navigate and open your SSOT rules')
    .action(async () => {
      await listRules(process.cwd());
    });

  program.parse(process.argv);
}

main().catch(console.error);
