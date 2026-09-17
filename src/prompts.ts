import fs from 'fs';
import path from 'path';
import pc from 'picocolors';
import { multiselect, select, isCancel } from '@clack/prompts';
import { ADAPTERS } from './adapters';

/**
 * Colors for this agent-selection prompt, keyed by adapter id — the same
 * mapping clean.ts uses for its own folder-selection prompt. Kept local
 * rather than on `AgentAdapter` itself; see clean.ts for why.
 */
const AGENT_COLORS: Record<string, (s: string) => string> = {
  cline: pc.blue,
  claude: pc.yellow,
  cursor: pc.cyan,
  gemini: pc.magenta,
  copilot: pc.green,
  windsurf: pc.blue,
};

/**
 * The multiselect options for "which agents should we compile for", derived
 * from the same registry sync.ts and clean.ts read. Previously a
 * hand-maintained array here, kept separately from clean.ts's own list —
 * the two had already drifted from each other once.
 */
const AGENT_OPTIONS = ADAPTERS.map((adapter) => ({
  value: adapter.id,
  label: `${adapter.label.padEnd(15)} ${pc.dim((AGENT_COLORS[adapter.id] ?? pc.dim)(`(${adapter.rulesDir})`))}`,
}));

export interface PromptAnswers {
  agents: string[];
  addToGitignore: boolean;
  addPostinstall: boolean;
}

export interface RunPromptsArgs {
  yes?: boolean;
  agents?: string[];
  addToGitignore?: boolean;
  addPostinstall?: boolean;
}

export async function runPrompts(initialArgs: RunPromptsArgs = {}): Promise<PromptAnswers | null> {
  const hasPackageJson = fs.existsSync(path.join(process.cwd(), 'package.json'));

  if (initialArgs.yes) {
    return {
      agents: initialArgs.agents || ['cursor', 'gemini'],
      addToGitignore: initialArgs.addToGitignore !== undefined ? initialArgs.addToGitignore : true,
      // Defaults to false: --yes used to force this true whenever a
      // package.json existed, with no flag to decline, so an agent following
      // our own non-interactive instructions could edit a user's
      // package.json without asking. --postinstall opts in explicitly.
      addPostinstall: initialArgs.addPostinstall === true
    };
  }

  let step = 0;
  let agents = initialArgs.agents || [];
  let addToGitignore = initialArgs.addToGitignore !== undefined ? initialArgs.addToGitignore : true;
  let addPostinstall = false;

  const totalSteps = hasPackageJson ? 3 : 2;

  while (step < totalSteps) {
    if (step === 0) {
      let agentsSelection: string[] | symbol;
      while (true) {
        agentsSelection = await multiselect({
          message: 'Which AI Agents do you want to compile rules for?',
          options: AGENT_OPTIONS,
          initialValues: agents.length > 0 ? agents : ['cursor', 'gemini'],
          required: false
        });
        if (isCancel(agentsSelection)) return null;
        if ((agentsSelection as string[]).length === 0) {
          console.log(pc.yellow('  ⚠  Select at least one agent to continue, or press Ctrl+C to exit at any time.'));
          continue;
        }
        break;
      }
      if (isCancel(agentsSelection)) return null;
      agents = agentsSelection as string[];
      step++;
    }

    if (step === 1) {
      const gitignoreSelection: any = await select({
        message: 'Do you want to ignore the compiled agent folders in Git? (Recommended)',
        options: [
          { value: 'yes', label: 'Yes, ignore them (Only track .codebuddy/ in Git)' },
          { value: 'no', label: 'No, I want to commit the compiled folders for my team' },
          { value: 'go_back', label: '⬅️  Go Back' }
        ],
        initialValue: addToGitignore ? 'yes' : 'no'
      });
      
      if (isCancel(gitignoreSelection)) return null;
      if (gitignoreSelection === 'go_back') {
        step--;
        continue;
      }
      addToGitignore = gitignoreSelection === 'yes';
      step++;
    }

    if (step === 2 && hasPackageJson) {
      const postinstallSelection: any = await select({
        message: 'Add a postinstall script to package.json? (Compiles rules automatically for teammates)',
        options: [
          { value: 'yes', label: 'Yes (Recommended for teams)' },
          { value: 'no', label: 'No, I will run sync manually' },
          { value: 'go_back', label: '⬅️  Go Back' }
        ],
      });
      
      if (isCancel(postinstallSelection)) return null;
      if (postinstallSelection === 'go_back') {
        step--;
        continue;
      }
      addPostinstall = postinstallSelection === 'yes';
      step++;
    }
  }

  return {
    agents,
    addToGitignore,
    addPostinstall
  };
}
