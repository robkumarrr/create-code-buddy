import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listRules } from './list';
import fs from 'fs';
import { select } from '@clack/prompts';
import { exec } from 'child_process';

vi.mock('fs');
vi.mock('child_process');
vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  select: vi.fn(),
  isCancel: vi.fn((val) => val === undefined || val === null)
}));
vi.mock('picocolors', () => ({
  default: {
    bgCyan: vi.fn(s => s),
    black: vi.fn(s => s),
    red: vi.fn(s => s),
    yellow: vi.fn(s => s),
    green: vi.fn(s => s)
  }
}));

describe('listRules', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should show error if no agent config is found', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    
    await listRules('/fake/path');
    
    const { outro } = await import('@clack/prompts');
    expect(outro).toHaveBeenCalledWith(expect.stringContaining('No agent configuration folder found'));
  });

  it('should show error if no markdown files are found', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => (p as string).includes('.agents'));
    vi.mocked(fs.readdirSync).mockReturnValue([]);
    
    await listRules('/fake/path');
    
    const { outro } = await import('@clack/prompts');
    expect(outro).toHaveBeenCalledWith(expect.stringContaining('No markdown rules found'));
  });

  it('should list files and open selected one', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => (p as string).includes('.agents'));
    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: 'rule1.md', isDirectory: () => false } as any
    ]);
    
    vi.mocked(select).mockResolvedValue('/fake/path/.agents/rule1.md');
    
    await listRules('/fake/path');
    
    expect(exec).toHaveBeenCalled();
  });
});
