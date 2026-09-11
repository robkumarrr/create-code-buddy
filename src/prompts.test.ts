import { describe, it, expect, vi } from 'vitest';
import { runPrompts } from './prompts';
import * as clackPrompts from '@clack/prompts';

vi.mock('@clack/prompts', () => ({
  select: vi.fn(),
  multiselect: vi.fn(),
  isCancel: vi.fn((val) => val === Symbol.for('cancel')),
  cancel: vi.fn(),
}));

describe('prompts', () => {
  it('should return null if user cancels the multiselect prompt', async () => {
    vi.mocked(clackPrompts.multiselect).mockResolvedValueOnce(Symbol.for('cancel'));

    const result = await runPrompts();
    expect(result).toBeNull();
  });

  it('should return answers if user completes all prompts', async () => {
    vi.mocked(clackPrompts.multiselect)
      .mockResolvedValueOnce(['cursor', 'gemini']);
      
    vi.mocked(clackPrompts.select)
      .mockResolvedValueOnce('yes'); // gitignore

    const result = await runPrompts();
    expect(result).toEqual({
      agents: ['cursor', 'gemini'],
      addToGitignore: true,
      addPostinstall: false,
      updateAgentsMd: false
    });
  });

  it('should bypass prompts if initialArgs.yes is true', async () => {
    vi.mocked(clackPrompts.multiselect).mockClear();
    vi.mocked(clackPrompts.select).mockClear();

    const result = await runPrompts({
      yes: true,
      agents: ['copilot']
    });

    expect(clackPrompts.multiselect).not.toHaveBeenCalled();
    expect(result).toEqual({
      agents: ['copilot'],
      addToGitignore: true,
      addPostinstall: expect.any(Boolean),
      updateAgentsMd: false
    });
  });
});
