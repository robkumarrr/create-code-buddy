import { select, confirm, isCancel, cancel } from '@clack/prompts';

export interface PromptAnswers {
  framework: string;
  agent: string;
  addToGitignore: boolean;
}

export async function runPrompts(): Promise<PromptAnswers | null> {
  const framework = await select({
    message: 'Which framework are you scaffolding context for?',
    options: [
      { value: 'laravel', label: 'Laravel (PHP)' },
      { value: 'nextjs', label: 'Next.js (React)' },
      { value: 'nodejs', label: 'Node.js (Express/Nest)' },
      { value: 'csharp-dotnet', label: 'C# .NET' },
      { value: 'general', label: 'General Best Practices (Language Agnostic)' },
      { value: 'empty', label: 'Empty (Start from scratch)' }
    ]
  });

  if (isCancel(framework)) return null;

  const agent = await select({
    message: 'Which AI Agent do you want to configure?',
    options: [
      { value: 'gemini', label: 'Gemini (Antigravity)' },
      { value: 'cursor', label: 'Cursor (Cursorrules)' },
      { value: 'copilot', label: 'GitHub Copilot' },
      { value: 'generic', label: 'Generic / Claude (Standard Markdown)' }
    ]
  });

  if (isCancel(agent)) return null;

  const addToGitignore = await confirm({
    message: 'Do you want to keep these rules personal? (If yes, we will add the config folder to your .gitignore)',
    initialValue: false // Defaults to committing them for the team
  });

  if (isCancel(addToGitignore)) return null;

  return {
    framework: framework as string,
    agent: agent as string,
    addToGitignore: addToGitignore as boolean
  };
}
