import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listRules } from './list';
import fs from 'fs';
import * as prompts from '@clack/prompts';

vi.mock('fs');
vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  select: vi.fn(),
  isCancel: vi.fn(() => false)
}));
vi.mock('picocolors', () => ({
  default: {
    green: vi.fn(s => s),
    red: vi.fn(s => s),
    yellow: vi.fn(s => s),
    cyan: vi.fn(s => s),
    bgCyan: vi.fn(s => s),
    black: vi.fn(s => s),
    dim: vi.fn(s => s),
    underline: vi.fn(s => s)
  }
}));

describe('listRules', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should show error if no codebuddy config is found', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    await listRules('/fake/path');

    expect(prompts.outro).toHaveBeenCalledWith(expect.stringContaining('No .codebuddy folder found'));
  });

  it('should show error if no markdown files are found', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue([]);

    await listRules('/fake/path');

    expect(prompts.outro).toHaveBeenCalledWith(expect.stringContaining('No markdown rules found'));
  });

  it('should print a clickable link to the selected file', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: 'test.md', isDirectory: () => false } as any
    ]);
    vi.mocked(prompts.select).mockResolvedValue('/fake/path/.codebuddy/test.md');

    await listRules('/fake/path');

    expect(prompts.outro).toHaveBeenCalledWith(expect.stringContaining('Open this file in your editor:'));
  });
});
