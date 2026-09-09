import fs from 'fs';
import path from 'path';
import pc from 'picocolors';
import { multiselect, select, isCancel } from '@clack/prompts';

export interface PromptAnswers {
  agents: string[];
  addToGitignore: boolean;
  addPostinstall: boolean;
}

export interface RunPromptsArgs {
  yes?: boolean;
  agents?: string[];
  addToGitignore?: boolean;
}

export async function runPrompts(initialArgs: RunPromptsArgs = {}): Promise<PromptAnswers | null> {
  const hasPackageJson = fs.existsSync(path.join(process.cwd(), 'package.json'));

  if (initialArgs.yes) {
    return {
      agents: initialArgs.agents || ['cursor', 'gemini'],
      addToGitignore: initialArgs.addToGitignore !== undefined ? initialArgs.addToGitignore : true,
      addPostinstall: hasPackageJson
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
