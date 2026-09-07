import { multiselect, select, isCancel } from '@clack/prompts';

export interface PromptAnswers {
  agents: string[];
  addToGitignore: boolean;
}

export interface RunPromptsArgs {
  yes?: boolean;
  agents?: string[];
  addToGitignore?: boolean;
}

export async function runPrompts(initialArgs: RunPromptsArgs = {}): Promise<PromptAnswers | null> {
  if (initialArgs.yes) {
    return {
      agents: initialArgs.agents || ['cursor', 'gemini'],
      addToGitignore: initialArgs.addToGitignore !== undefined ? initialArgs.addToGitignore : true
    };
  }

  let step = 0;
  let agents = initialArgs.agents || [];
  let addToGitignore = initialArgs.addToGitignore !== undefined ? initialArgs.addToGitignore : true;

  while (step < 2) {
    if (step === 0) {
      const agentsSelection = await multiselect({
        message: 'Which AI Agents do you want to compile rules for?',
        options: [
          { value: 'cursor', label: 'Cursor (.cursor/rules)' },
          { value: 'gemini', label: 'Gemini (.agents)' },
          { value: 'copilot', label: 'GitHub Copilot (.github/instructions)' },
          { value: 'generic', label: 'Generic / Claude (agent-config)' }
        ],
        initialValues: agents.length > 0 ? agents : ['cursor', 'gemini'],
        required: true
      });
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
  }

  return {
    agents,
    addToGitignore
  };
}
