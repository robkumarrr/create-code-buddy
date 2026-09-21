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
import { migrate } from './migrate';
import { ADAPTER_IDS } from './adapters';
import { fail } from './core/report';
import { TOOL_NAME, TOOL_VERSION, SSOT_DIR, CONFIG_FILE } from './core/constants';

async function main() {
  program
    .name(TOOL_NAME)
    .description('A CLI tool to compile and manage agentic context and rules.')
    .version(TOOL_VERSION)
    .addHelpText('after', `
Examples:
  $ npx ${TOOL_NAME} init         # Interactive setup wizard
  $ npx ${TOOL_NAME} edit         # Edit existing agent config
  $ npx ${TOOL_NAME} add          # Interactively add a rule
  $ npx ${TOOL_NAME} sync         # Manually compile rules
  $ npx ${TOOL_NAME} clean        # Delete compiled folders
  $ npx ${TOOL_NAME} list         # View and navigate rules
  $ npx ${TOOL_NAME} migrate      # Move an older layout into .codebuddy/rules/
`);

  program
    .command('init', { isDefault: true })
    .alias('edit')
    .alias('config')
    .description(`Scaffold or edit your ${SSOT_DIR}/ SSOT and configure AI Agents`)
    .option('-y, --yes', 'Skip prompts and use default configuration')
    .option('-a, --agents <agents>', `Comma-separated list of agents to configure (${ADAPTER_IDS.join(',')})`)
    .option('--no-gitignore', 'Do not add compiled folders to .gitignore')
    .option('--no-agents-md', 'Do not write a rule index into AGENTS.md')
    .option('--no-claude-md', 'Do not write an index into CLAUDE.md for Claude Code')
    .option('--postinstall', 'Add a postinstall script to package.json (compiles rules automatically for teammates)')
    .option('--no-postinstall', 'Do not add a postinstall script (default under --yes)')
    .action(async (cliOptions) => {
      console.clear();
      
      const asciiLogo = `
 _ _  _| _ |_     _| _|   
(_(_)(_|(/_|_)|_|(_|(_|\\/ 
                       /  
`;
      console.log(pc.cyan(asciiLogo));
      intro(pc.bgCyan(pc.black(` ${TOOL_NAME} `)));

      const existingConfig = getConfig(process.cwd());
      if (existingConfig) {
        console.log(pc.dim(`Found existing ${SSOT_DIR}/${CONFIG_FILE}. Loading your settings...\n`));
      } else {
        console.log(pc.cyan(`Welcome to ${TOOL_NAME}! 🤖\n`));
        console.log(pc.white('Instead of manually editing your AI agent\'s rules folder (.cursorrules, .agents, etc),'));
        console.log(pc.white('you will now write your rules once in a centralized ') + pc.bold(pc.cyan(`${SSOT_DIR}/`)) + pc.white(' folder.'));
        console.log(pc.white('This wizard configures which agent folders we should auto-compile those rules into.\n'));
        console.log(pc.dim('(We\'ve pre-selected some defaults for you below, feel free to make your own selections)\n'));
      }

      let parsedAgents;
      if (cliOptions.agents) {
        parsedAgents = cliOptions.agents.split(',').map((a: string) => a.trim());

        const unknownIds = parsedAgents.filter((id: string) => !ADAPTER_IDS.includes(id));
        if (unknownIds.length > 0) {
          fail(
            `Unknown agent id${unknownIds.length > 1 ? 's' : ''}: ${unknownIds.join(', ')}. ` +
              `Valid agents are: ${ADAPTER_IDS.join(', ')}.`,
          );
          return;
        }
      } else if (existingConfig) {
        parsedAgents = existingConfig.agents;
      }

      const answers = await runPrompts({
        yes: cliOptions.yes,
        agents: parsedAgents,
        addToGitignore: cliOptions.gitignore === false ? false : (existingConfig ? existingConfig.gitignore_compiled_agents : undefined),
        addPostinstall: cliOptions.postinstall,
        addAgentsMd: cliOptions.agentsMd,
        addClaudeMd: cliOptions.claudeMd
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
    .option('--hard', `Factory reset: Also delete your ${SSOT_DIR}/ source files (Irreversible!)`)
    .option('--force', 'Skip the --hard confirmation prompts (required in a non-interactive shell)')
    .action(async (cliOptions) => {
      // clean --hard's confirmations read from stdin, which a non-interactive
      // shell (a git hook, a CI step) either closes or never sends anything
      // on -- without this check that would hang rather than fail. --force
      // exists to skip both prompts in exactly that case; require it
      // explicitly rather than silently proceeding unconfirmed.
      if (cliOptions.hard && !process.stdin.isTTY && !cliOptions.force) {
        fail(
          'clean --hard needs interactive confirmation and stdin is not a TTY. ' +
            'Re-run with --force to skip the prompts in a non-interactive shell.',
        );
        return;
      }
      await cleanAgents(process.cwd(), cliOptions.hard, cliOptions.force);
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
    .command('migrate')
    .description(`Move rules from an older flat ${SSOT_DIR}/ layout into ${SSOT_DIR}/rules/`)
    .option('--apply', 'Actually move the files (without this, only shows what would change)')
    .action(async (cliOptions) => {
      await migrate(process.cwd(), cliOptions.apply);
    });

  program
    .command('list')
    .description('Navigate and open your SSOT rules')
    .action(async () => {
      await listRules(process.cwd());
    });

  program.parse(process.argv);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
