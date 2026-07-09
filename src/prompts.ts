import { select, isCancel } from '@clack/prompts';

export interface PromptAnswers {
  framework: string;
  agent: string;
  addToGitignore: boolean;
  laravelBoost?: string;
  options: Record<string, string>;
}

export interface RunPromptsArgs {
  yes?: boolean;
  framework?: string;
  agent?: string;
  options?: Record<string, string>;
}

export async function runPrompts(initialArgs: RunPromptsArgs = {}): Promise<PromptAnswers | null> {
  if (initialArgs.yes) {
    return {
      framework: initialArgs.framework || 'laravel',
      agent: initialArgs.agent || 'gemini',
      addToGitignore: false,
      laravelBoost: 'code_buddy', // skip boost installation via non-interactive mode
      options: initialArgs.options || {}
    };
  }

  let step = 0;
  
  // Remember selections
  let framework = initialArgs.framework || '';
  let agent = initialArgs.agent || '';
  let addToGitignore = false;
  let laravelBoost = '';
  let options: Record<string, string> = initialArgs.options || {};

  while (step < 5) {
    if (step === 0) {
      const frameworkSelection: any = await select({
        message: 'Which framework are you scaffolding context for?',
        options: [
          { value: 'laravel', label: 'Laravel (PHP)' },
          { value: 'nextjs', label: 'Next.js (React)' },
          { value: 'nodejs', label: 'Node.js (Express/Nest)' },
          { value: 'csharp-dotnet', label: 'C# .NET' },
          { value: 'general', label: 'General Best Practices (Language Agnostic)' },
          { value: 'empty', label: 'Empty (Start from scratch)' }
        ],
        initialValue: framework || 'laravel'
      });
      if (isCancel(frameworkSelection)) return null;
      framework = frameworkSelection as string;
      step++;
    }

    if (step === 1) {
      if (framework === 'laravel') {
        const boostSelection: any = await select({
          message: '💡 Did you know Laravel has an official package called Laravel Boost? It scaffolds rules AND acts as an MCP server!',
          options: [
            { value: 'boost_only', label: 'Use Laravel Boost (We will run composer require for you)' },
            { value: 'both', label: 'Use Both (Install Boost + scaffold our custom specs/UI rules)' },
            { value: 'code_buddy', label: 'Just use Code Buddy (Standard markdown rules only)' },
            { value: 'go_back', label: '⬅️  Go Back' }
          ],
          initialValue: laravelBoost || 'both'
        });
        if (isCancel(boostSelection)) return null;
        if (boostSelection === 'go_back') {
          step--;
          continue;
        }
        laravelBoost = boostSelection as string;
      }
      step++;
    }

    if (step === 2) {
      // Dynamic Framework Options
      if (framework === 'nextjs') {
        const routerSelection: any = await select({
          message: 'Which router are you using?',
          options: [
            { value: 'app', label: 'App Router (Next 13+)' },
            { value: 'pages', label: 'Pages Router' },
            { value: 'go_back', label: '⬅️  Go Back' }
          ],
          initialValue: options.router || 'app'
        });
        if (isCancel(routerSelection)) return null;
        if (routerSelection === 'go_back') {
          step--;
          continue;
        }
        options.router = routerSelection;

        const stylingSelection: any = await select({
          message: 'Which styling solution are you using?',
          options: [
            { value: 'tailwind', label: 'Tailwind CSS' },
            { value: 'css-modules', label: 'CSS Modules' }
          ],
          initialValue: options.styling || 'tailwind'
        });
        if (isCancel(stylingSelection)) return null;
        options.styling = stylingSelection;
      } else if (framework === 'laravel') {
        const frontendSelection: any = await select({
          message: 'Which frontend stack are you using?',
          options: [
            { value: 'blade', label: 'Blade Templates' },
            { value: 'livewire', label: 'Livewire' },
            { value: 'inertia-vue', label: 'Inertia (Vue)' },
            { value: 'inertia-react', label: 'Inertia (React)' },
            { value: 'inertia-svelte', label: 'Inertia (Svelte)' },
            { value: 'api-only', label: 'API Only' },
            { value: 'go_back', label: '⬅️  Go Back' }
          ],
          initialValue: options.frontend || 'livewire'
        });
        if (isCancel(frontendSelection)) return null;
        if (frontendSelection === 'go_back') {
          step--;
          continue;
        }
        options.frontend = frontendSelection;

        const testingSelection: any = await select({
          message: 'Which testing framework are you using?',
          options: [
            { value: 'pest', label: 'Pest PHP' },
            { value: 'phpunit', label: 'PHPUnit' }
          ],
          initialValue: options.testing || 'pest'
        });
        if (isCancel(testingSelection)) return null;
        options.testing = testingSelection;
      } else if (framework === 'nodejs') {
        const architectureSelection: any = await select({
          message: 'Which architecture are you using?',
          options: [
            { value: 'express', label: 'Express.js (Minimalist)' },
            { value: 'nestjs', label: 'NestJS (Opinionated/Angular-like)' },
            { value: 'go_back', label: '⬅️  Go Back' }
          ],
          initialValue: options.architecture || 'express'
        });
        if (isCancel(architectureSelection)) return null;
        if (architectureSelection === 'go_back') {
          step--;
          continue;
        }
        options.architecture = architectureSelection;

        const languageSelection: any = await select({
          message: 'Which language are you using?',
          options: [
            { value: 'typescript', label: 'TypeScript (Recommended)' },
            { value: 'javascript', label: 'JavaScript' }
          ],
          initialValue: options.language || 'typescript'
        });
        if (isCancel(languageSelection)) return null;
        options.language = languageSelection;
      } else if (framework === 'csharp-dotnet') {
        const architectureSelection: any = await select({
          message: 'Which architecture are you using?',
          options: [
            { value: 'minimal', label: 'Minimal APIs (Modern/Lightweight)' },
            { value: 'controllers', label: 'Controllers (Web API)' },
            { value: 'mvc', label: 'MVC (Traditional with Views)' },
            { value: 'go_back', label: '⬅️  Go Back' }
          ],
          initialValue: options.architecture || 'minimal'
        });
        if (isCancel(architectureSelection)) return null;
        if (architectureSelection === 'go_back') {
          step--;
          continue;
        }
        options.architecture = architectureSelection;
      }
      step++;
    }

    if (step === 3) {
      const agentSelection: any = await select({
        message: 'Which AI Agent do you want to configure?',
        options: [
          { value: 'gemini', label: 'Gemini (Antigravity)' },
          { value: 'cursor', label: 'Cursor (Cursorrules)' },
          { value: 'copilot', label: 'GitHub Copilot' },
          { value: 'generic', label: 'Generic / Claude (Standard Markdown)' },
          { value: 'go_back', label: '⬅️  Go Back' }
        ],
        initialValue: agent || 'gemini'
      });
      if (isCancel(agentSelection)) return null;
      if (agentSelection === 'go_back') {
        step--;
        continue;
      }
      agent = agentSelection as string;
      step++;
    }

    if (step === 4) {
      const gitignoreSelection: any = await select({
        message: 'Do you want to keep these rules personal? (If yes, we will add the config folder to your .gitignore)',
        options: [
          { value: 'team', label: 'Commit for the team (Default)' },
          { value: 'personal', label: 'Keep it personal (Add to .gitignore)' },
          { value: 'go_back', label: '⬅️  Go Back' }
        ],
        initialValue: addToGitignore ? 'personal' : 'team'
      });
      
      if (isCancel(gitignoreSelection)) return null;
      if (gitignoreSelection === 'go_back') {
        step--;
        continue;
      }
      addToGitignore = gitignoreSelection === 'personal';
      step++;
    }
  }

  return {
    framework,
    agent,
    addToGitignore,
    laravelBoost,
    options
  };
}
