import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateConfig } from './generator';
import fs from 'fs';
import { syncAgents } from './sync';

vi.mock('fs');
vi.mock('./sync', () => ({
  syncAgents: vi.fn()
}));
vi.mock('picocolors', () => ({
  default: {
    green: vi.fn(s => s),
    cyan: vi.fn(s => s),
    dim: vi.fn(s => s),
    bold: vi.fn(s => s)
  }
}));

describe('generator', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should generate baseline codebuddy rules and call sync', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    
    await generateConfig({
      agents: ['cursor', 'gemini'],
      addToGitignore: true,
      addPostinstall: false
    }, '/fake/path');

    expect(fs.mkdirSync).toHaveBeenCalled();
    expect(fs.writeFileSync).toHaveBeenCalled();
    expect(syncAgents).toHaveBeenCalledWith('/fake/path');
  });
});
