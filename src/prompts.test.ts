import { describe, it, expect, vi } from 'vitest';
import { runPrompts } from './prompts';
import * as clackPrompts from '@clack/prompts';

vi.mock('@clack/prompts', () => ({
  select: vi.fn(),
  multiselect: vi.fn(),
  isCancel: vi.fn((val) => val === Symbol.for('cancel')),
  cancel: vi.fn(),
}));

/**
 * The mocked `isCancel` above recognizes this exact symbol, so it is the right
 * value for a cancelled prompt here.
 *
 * The cast is unavoidable: clack types cancellation as its own `unique symbol`,
 * which by definition only that module can produce. A test cannot construct one,
 * so it asserts at this single boundary rather than at every call site.
 */
const CANCEL = Symbol.for('cancel') as unknown as Awaited<
  ReturnType<typeof clackPrompts.multiselect>
>;

describe('prompts', () => {
  it('should return null if user cancels the multiselect prompt', async () => {
    vi.mocked(clackPrompts.multiselect).mockResolvedValueOnce(CANCEL);

    const result = await runPrompts();
    expect(result).toBeNull();
  });

  it('should return answers if user completes all prompts', async () => {
    vi.mocked(clackPrompts.multiselect)
      .mockResolvedValueOnce(['cursor', 'gemini']);
      
    // One per step. The postinstall step only appears when a package.json is
    // present, which it is — this runs in the repo root.
    vi.mocked(clackPrompts.select)
      .mockResolvedValueOnce('yes')  // gitignore
      .mockResolvedValueOnce('no')   // postinstall
      .mockResolvedValueOnce('yes'); // AGENTS.md index

    const result = await runPrompts();
    expect(result).toEqual({
      agents: ['cursor', 'gemini'],
      addToGitignore: true,
      addPostinstall: false,
      addAgentsMd: true
    });
  });

  it('does not ask about AGENTS.md when --no-agents-md already answered it', async () => {
    vi.mocked(clackPrompts.multiselect).mockClear();
    vi.mocked(clackPrompts.select).mockClear();
    vi.mocked(clackPrompts.multiselect).mockResolvedValueOnce(['cursor']);
    vi.mocked(clackPrompts.select)
      .mockResolvedValueOnce('yes')  // gitignore
      .mockResolvedValueOnce('no');  // postinstall
    // Deliberately no third answer: if the AGENTS.md step still ran it would
    // consume an unmocked select, resolve undefined, and fall through as "no"
    // -- the same value, reached by asking a question the user already
    // answered on the command line.

    const result = await runPrompts({ addAgentsMd: false });

    expect(result?.addAgentsMd).toBe(false);
    expect(vi.mocked(clackPrompts.select)).toHaveBeenCalledTimes(2);
  });

  it('still asks about AGENTS.md when the flag was not passed', async () => {
    vi.mocked(clackPrompts.multiselect).mockClear();
    vi.mocked(clackPrompts.select).mockClear();
    vi.mocked(clackPrompts.multiselect).mockResolvedValueOnce(['cursor']);
    vi.mocked(clackPrompts.select)
      .mockResolvedValueOnce('yes')  // gitignore
      .mockResolvedValueOnce('no')   // postinstall
      .mockResolvedValueOnce('yes'); // AGENTS.md

    const result = await runPrompts();

    expect(result?.addAgentsMd).toBe(true);
    expect(vi.mocked(clackPrompts.select)).toHaveBeenCalledTimes(3);
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
      addAgentsMd: true
    });
  });
});
