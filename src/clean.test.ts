import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanAgents } from './clean';
import fs from 'fs';
import * as sync from './sync';
import { confirm } from '@clack/prompts';

vi.mock('fs');
vi.mock('./sync');
vi.mock('@clack/prompts', () => ({
  confirm: vi.fn(),
  isCancel: vi.fn(() => false)
}));
vi.mock('picocolors', () => ({
  default: {
    green: vi.fn(s => s),
    red: vi.fn(s => s),
    yellow: vi.fn(s => s),
    dim: vi.fn(s => s)
  }
}));

describe('cleanAgents', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should exit if user cancels', async () => {
    vi.mocked(confirm).mockResolvedValue(false);
    await cleanAgents('/fake/path');
    expect(fs.rmSync).not.toHaveBeenCalled();
  });

  it('should delete agent folders and call updateGitignore', async () => {
    vi.mocked(confirm).mockResolvedValue(true);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    
    await cleanAgents('/fake/path');
    
    expect(fs.rmSync).toHaveBeenCalledTimes(4); // .cursor, .agents, .github, agent-config
    expect(sync.updateGitignore).toHaveBeenCalledWith('/fake/path', [], true);
  });
});
