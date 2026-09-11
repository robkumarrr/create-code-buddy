#!/usr/bin/env node

import { intro, outro } from '@clack/prompts';
import pc from 'picocolors';
import { program } from 'commander';
import { runPrompts } from './prompts';
import { generateConfig } from './generator';
import { addEntry } from './add';
import { listRules } from './list';
import { syncAgents, getConfig } from './sync';
import { cleanAgents } from './clean';

async function main() {
  program
    .name('create-code-buddy')
    .description('A CLI tool to compile and manage agentic context and rules.')
    .version('1.0.0')
    .addHelpText('after', `
Examples:
  $ npx create-code-buddy init         # Interactive setup wizard
  $ npx create-code-buddy edit         # Edit existing agent config
  $ npx create-code-buddy add          # Interactively add a rule
  $ npx create-code-buddy sync         # Manually compile rules
  $ npx create-code-buddy clean        # Delete compiled folders
  $ npx create-code-buddy list         # View and navigate rules
`);

  program
    .command('init', { isDefault: true })
    .alias('edit')
    .alias('config')
    .description('Scaffold or edit your .codebuddy/ SSOT and configure AI Agents')
    .option('-y, --yes', 'Skip prompts and use default configuration')
    .option('-a, --agents <agents>', 'Comma-separated list of agents to configure (cursor,gemini,copilot,generic)')
    .option('--no-gitignore', 'Do not add compiled folders to .gitignore')
    .option('--agents-md', 'Append a pointer block to AGENTS.md (for Codex/Zed discovery)')
    .action(async (cliOptions) => {
      console.clear();
      
      const asciiLogo = `
 _ _  _| _ |_     _| _|   
(_(_)(_|(/_|_)|_|(_|(_|\\/ 
                       /  
`;
      console.log(pc.cyan(asciiLogo));
      intro(pc.bgCyan(pc.black(' create-code-buddy ')));

      const existingConfig = getConfig(process.cwd());
      if (existingConfig) {
        console.log(pc.dim('Found existing .codebuddy/config.json. Loading your settings...\n'));
      } else {
        console.log(pc.cyan('Welcome to create-code-buddy! 🤖\n'));
        console.log(pc.white('Instead of manually editing your AI agent\'s rules folder (.cursorrules, .agents, etc),'));
        console.log(pc.white('you will now write your rules once in a centralized ') + pc.bold(pc.cyan('.codebuddy/')) + pc.white(' folder.'));
        console.log(pc.white('This wizard configures which agent folders we should auto-compile those rules into.\n'));
        console.log(pc.dim('(We\'ve pre-selected some defaults for you below, feel free to make your own selections)\n'));
      }

      let parsedAgents;
      if (cliOptions.agents) {
        parsedAgents = cliOptions.agents.split(',').map((a: string) => a.trim());
      } else if (existingConfig) {
        parsedAgents = existingConfig.agents;
      }

      const answers = await runPrompts({
        yes: cliOptions.yes,
        agents: parsedAgents,
        addToGitignore: cliOptions.gitignore === false ? false : (existingConfig ? existingConfig.gitignore_compiled_agents : undefined),
        updateAgentsMd: cliOptions.agentsMd || (existingConfig ? existingConfig.update_agents_md : undefined)
      });

      if (!answers) {
        outro(pc.yellow('Setup cancelled. No files were created.'));
        process.exit(0);
      }

      await generateConfig(answers, process.cwd());
      outro(pc.green('Code Buddy has been configured successfully! 🚀'));
    });

  program
    .command('sync')
    .description('Compile the single-source of truth markdown rules into agent-specific folders')
    .action(async () => {
      await syncAgents(process.cwd());
    });

  program
    .command('clean')
    .description('Remove compiled agent folders and clean up .gitignore')
    .option('--hard', 'Factory reset: Also delete your .codebuddy/ source files (Irreversible!)')
    .action(async (cliOptions) => {
      await cleanAgents(process.cwd(), cliOptions.hard);
    });

  program
    .command('add')
    .description('Add a new rule (interactive by default, scriptable for agents)')
    .option('-n, --name <name>', 'Name of the rule (e.g. backend/database)')
    .option('-g, --globs <globs>', 'Target globs (e.g. "*.ts, *.js")')
    .option('-d, --description <desc>', 'Description of the rule')
    .action(async (cliOptions) => {
      await addEntry(process.cwd(), cliOptions);
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
