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
  addAgentsMd: boolean;
}

export interface RunPromptsArgs {
  yes?: boolean;
  agents?: string[];
  addToGitignore?: boolean;
  addPostinstall?: boolean;
  addAgentsMd?: boolean;
}

export async function runPrompts(initialArgs: RunPromptsArgs = {}): Promise<PromptAnswers | null> {
  const hasPackageJson = fs.existsSync(path.join(process.cwd(), 'package.json'));
  // Asked either way: sync creates AGENTS.md when it's absent, so gating the
  // question on the file existing would write it without ever asking.
  const hasAgentsMd = fs.existsSync(path.join(process.cwd(), 'AGENTS.md'));

  if (initialArgs.yes) {
    return {
      agents: initialArgs.agents || ['cursor', 'gemini'],
      addToGitignore: initialArgs.addToGitignore !== undefined ? initialArgs.addToGitignore : true,
      // Defaults to false: --yes used to force this true whenever a
      // package.json existed, with no flag to decline, so an agent following
      // our own non-interactive instructions could edit a user's
      // package.json without asking. --postinstall opts in explicitly.
      addPostinstall: initialArgs.addPostinstall === true,
      addAgentsMd: initialArgs.addAgentsMd !== false
    };
  }

  let step = 0;
  let agents = initialArgs.agents || [];
  let addToGitignore = initialArgs.addToGitignore !== undefined ? initialArgs.addToGitignore : true;
  let addPostinstall = false;
  let addAgentsMd = initialArgs.addAgentsMd !== false;

  const totalSteps = 3 + (hasPackageJson ? 1 : 0);

  const stepToType: Record<number, 'agents' | 'gitignore' | 'postinstall' | 'agentsmd'> = {};
  let currentStepIdx = 0;
  stepToType[currentStepIdx++] = 'agents';
  stepToType[currentStepIdx++] = 'gitignore';
  if (hasPackageJson) stepToType[currentStepIdx++] = 'postinstall';
  stepToType[currentStepIdx++] = 'agentsmd';

  while (step < totalSteps) {
    const currentAction = stepToType[step];

    if (currentAction === 'agents') {
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

    if (currentAction === 'gitignore') {
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

    if (currentAction === 'postinstall') {
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

    if (currentAction === 'agentsmd') {
      const agentsMdSelection: any = await select({
        message: hasAgentsMd
          ? 'Add a rule index to your AGENTS.md? (Helps Codex, Zed and others discover rules)'
          : 'Write a rule index to AGENTS.md? (Helps Codex, Zed and others discover rules)',
        options: [
          {
            value: 'yes',
            label: hasAgentsMd
              ? 'Yes — only the block between our markers is ever rewritten'
              : 'Yes, create AGENTS.md with an index of the rules'
          },
          { value: 'no', label: 'No, leave AGENTS.md alone' },
          { value: 'go_back', label: '⬅️  Go Back' }
        ],
        initialValue: addAgentsMd ? 'yes' : 'no'
      });

      if (isCancel(agentsMdSelection)) return null;
      if (agentsMdSelection === 'go_back') {
        step--;
        continue;
      }
      addAgentsMd = agentsMdSelection === 'yes';
      step++;
    }
  }

  return {
    agents,
    addToGitignore,
    addPostinstall,
    addAgentsMd
  };
}
