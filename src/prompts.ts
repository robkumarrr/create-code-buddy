import fs from 'fs';
import path from 'path';
import pc from 'picocolors';
import { multiselect, select, isCancel } from '@clack/prompts';

export interface PromptAnswers {
  agents: string[];
  addToGitignore: boolean;
  addPostinstall: boolean;
  updateAgentsMd?: boolean;
}

export interface RunPromptsArgs {
  yes?: boolean;
  agents?: string[];
  addToGitignore?: boolean;
  updateAgentsMd?: boolean;
}

export async function runPrompts(initialArgs: RunPromptsArgs = {}): Promise<PromptAnswers | null> {
  const hasPackageJson = fs.existsSync(path.join(process.cwd(), 'package.json'));
  const hasAgentsMd = fs.existsSync(path.join(process.cwd(), 'AGENTS.md'));

  if (initialArgs.yes) {
    return {
      agents: initialArgs.agents || ['cursor', 'gemini'],
      addToGitignore: initialArgs.addToGitignore !== undefined ? initialArgs.addToGitignore : true,
      addPostinstall: hasPackageJson,
      updateAgentsMd: !!initialArgs.updateAgentsMd
    };
  }

  let step = 0;
  let agents = initialArgs.agents || [];
  let addToGitignore = initialArgs.addToGitignore !== undefined ? initialArgs.addToGitignore : true;
  let addPostinstall = false;
  let updateAgentsMd = false;

  const totalSteps = 2 + (hasPackageJson ? 1 : 0) + (hasAgentsMd ? 1 : 0);

  const stepToType: Record<number, 'agents' | 'gitignore' | 'postinstall' | 'agentsmd'> = {};
  let currentStepIdx = 0;
  stepToType[currentStepIdx++] = 'agents';
  stepToType[currentStepIdx++] = 'gitignore';
  if (hasPackageJson) stepToType[currentStepIdx++] = 'postinstall';
  if (hasAgentsMd) stepToType[currentStepIdx++] = 'agentsmd';

  while (step < totalSteps) {
    const currentAction = stepToType[step];

    if (currentAction === 'agents') {
      let agentsSelection: string[] | symbol;
      while (true) {
        agentsSelection = await multiselect({
          message: 'Which AI Agents do you want to compile rules for?',
          options: [
            { value: 'cline',   label: `Cline          ${pc.dim(pc.blue('(.clinerules)'))}` },
            { value: 'claude',  label: `Claude Code    ${pc.dim(pc.yellow('(.claude/rules)'))}` },
            { value: 'cursor',  label: `Cursor         ${pc.dim(pc.cyan('(.cursor/rules)'))}` },
            { value: 'gemini',  label: `Gemini         ${pc.dim(pc.magenta('(.agents)'))}` },
            { value: 'copilot', label: `GitHub Copilot ${pc.dim(pc.green('(.github/instructions)'))}` },
            { value: 'windsurf',label: `Windsurf       ${pc.dim(pc.blue('(.windsurf/rules)'))}` },
          ],
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
        message: 'We detected an AGENTS.md file. Can we append a tiny pointer block to it? (Helps Codex & Zed discover rules)',
        options: [
          { value: 'yes', label: 'Yes, append a 4-line pointer block at the bottom' },
          { value: 'no', label: 'No, do not touch AGENTS.md' },
          { value: 'go_back', label: '⬅️  Go Back' }
        ],
        initialValue: updateAgentsMd ? 'yes' : 'no'
      });

      if (isCancel(agentsMdSelection)) return null;
      if (agentsMdSelection === 'go_back') {
        step--;
        continue;
      }
      updateAgentsMd = agentsMdSelection === 'yes';
      step++;
    }
  }

  return {
    agents,
    addToGitignore,
    addPostinstall,
    updateAgentsMd
  };
}
