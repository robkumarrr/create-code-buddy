import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncAgents, updateGitignore } from './sync';
import fs from 'fs';
import path from 'path';

vi.mock('fs');
vi.mock('picocolors', () => ({
  default: {
    green: vi.fn(s => s),
    red: vi.fn(s => s),
    cyan: vi.fn(s => s),
    dim: vi.fn(s => s)
  }
}));

describe('syncAgents', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should exit if no config is found', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    await syncAgents('/fake/path');
    expect(fs.readFileSync).not.toHaveBeenCalled();
  });

  it('should compile rules for selected agents', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((pathStr) => {
      if ((pathStr as string).endsWith('config.json')) {
        return JSON.stringify({ agents: ['cursor', 'gemini'], gitignore_compiled_agents: true });
      }
      return '---\ndescription: Test\nglobs: ["*.ts"]\n---\n# Content';
    });
    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: 'test.md', isDirectory: () => false } as any
    ]);

    await syncAgents('/fake/path');

    // Should create cursor MDC
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      path.join('/fake/path', '.cursor/rules/test.mdc'),
      '---\ndescription: Test\nglobs: ["*.ts"]\n---\n\n# Content'
    );

    // Should create gemini MD
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      path.join('/fake/path', '.agents/rules/test.md'),
      '---\ndescription: Test\nglobs: ["*.ts"]\n---\n# Content'
    );
  });
});

describe('updateGitignore', () => {
  it('should inject gitignore block safely', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('node_modules/\n');

    updateGitignore('/fake/path', ['.cursor/']);

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      path.join('/fake/path', '.gitignore'),
      'node_modules/\n\n# --- Create Code Buddy (Start) ---\n.cursor/\n# --- Create Code Buddy (End) ---\n'
    );
  });
});
