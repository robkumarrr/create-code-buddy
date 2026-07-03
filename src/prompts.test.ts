import { describe, it, expect, vi } from 'vitest';
import { runPrompts } from './prompts';
import * as clackPrompts from '@clack/prompts';

vi.mock('@clack/prompts', () => ({
  select: vi.fn(),
  confirm: vi.fn(),
  isCancel: vi.fn((val) => val === Symbol.for('cancel')),
  cancel: vi.fn(),
}));

describe('prompts', () => {
  it('should return null if user cancels the framework prompt', async () => {
    vi.mocked(clackPrompts.select).mockResolvedValueOnce(Symbol.for('cancel'));

    const result = await runPrompts();
    expect(result).toBeNull();
  });

  it('should return answers if user completes all prompts', async () => {
    // Mock the answers sequentially: framework, laravelBoost, frontend, testing, agent, gitignore
    vi.mocked(clackPrompts.select)
      .mockResolvedValueOnce('laravel')
      .mockResolvedValueOnce('both') // laravelBoost
      .mockResolvedValueOnce('inertia-svelte') // frontend selection
      .mockResolvedValueOnce('pest') // testing selection
      .mockResolvedValueOnce('cursor') // agent
      .mockResolvedValueOnce('personal'); // gitignore

    const result = await runPrompts();
    expect(result).toEqual({
      framework: 'laravel',
      laravelBoost: 'both',
      agent: 'cursor',
      addToGitignore: true,
      options: { frontend: 'inertia-svelte', testing: 'pest' }
    });
  });

  it('should bypass prompts if initialArgs.yes is true', async () => {
    vi.mocked(clackPrompts.select).mockClear();

    const result = await runPrompts({
      yes: true,
      framework: 'nextjs',
      agent: 'cursor',
      options: { router: 'app', styling: 'tailwind' }
    });

    // Should not have called select
    expect(clackPrompts.select).not.toHaveBeenCalled();

    expect(result).toEqual({
      framework: 'nextjs',
      agent: 'cursor',
      addToGitignore: false,
      laravelBoost: 'code_buddy',
      options: { router: 'app', styling: 'tailwind' }
    });
  });
});
