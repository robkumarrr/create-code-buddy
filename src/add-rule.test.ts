import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { addRule } from './add-rule';
import fs from 'fs';
import path from 'path';
import os from 'os';
import * as clackPrompts from '@clack/prompts';

vi.mock('@clack/prompts', () => ({
  text: vi.fn(),
  confirm: vi.fn(),
  intro: vi.fn(),
  outro: vi.fn(),
  isCancel: vi.fn((val) => val === Symbol.for('cancel')),
}));

describe('add-rule', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'create-code-buddy-add-rule-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('should abort if no agent configuration folder exists anywhere', async () => {
    await addRule('database', tempDir);
    expect(clackPrompts.outro).toHaveBeenCalledWith(expect.stringContaining('No agent configuration folder found'));
  });

  it('should successfully find agent folders via bounded find-up search', async () => {
    // Setup nested structure with a mock package.json acting as the root
    fs.writeFileSync(path.join(tempDir, 'package.json'), '{}');
    
    // Create the agent folder at the root
    const agentsDir = path.join(tempDir, '.agents');
    fs.mkdirSync(agentsDir);
    fs.mkdirSync(path.join(agentsDir, 'rules'));

    // Create a deeply nested directory
    const nestedDir = path.join(tempDir, 'src', 'components', 'ui');
    fs.mkdirSync(nestedDir, { recursive: true });

    // Mock prompt responses
    vi.mocked(clackPrompts.text).mockResolvedValueOnce('Database rules');

    // Run from the nested directory
    await addRule('database', nestedDir);

    // It should have found `.agents` at the root and created the file
    const targetFile = path.join(agentsDir, 'rules', 'database.md');
    expect(fs.existsSync(targetFile)).toBe(true);
    expect(fs.readFileSync(targetFile, 'utf-8')).toContain('# database');
  });

  it('should create a rule in a subdirectory if slashes are provided', async () => {
    // Setup root with .cursor/rules
    fs.writeFileSync(path.join(tempDir, 'package.json'), '{}');
    const cursorDir = path.join(tempDir, '.cursor', 'rules');
    fs.mkdirSync(cursorDir, { recursive: true });

    // Mock prompt responses
    vi.mocked(clackPrompts.text)
      .mockResolvedValueOnce('Backend spec') // description
      .mockResolvedValueOnce('src/backend/**/*.ts'); // globs

    await addRule('specs/backend', tempDir);

    const targetFile = path.join(cursorDir, 'specs', 'backend.mdc');
    expect(fs.existsSync(targetFile)).toBe(true);
    
    const content = fs.readFileSync(targetFile, 'utf-8');
    expect(content).toContain('description: Backend spec');
    expect(content).toContain('globs: ["src/backend/**/*.ts"]');
    expect(content).toContain('# specs/backend');
  });

  it('should prompt to overwrite if the rule already exists and abort if declined', async () => {
    // Setup root with .agents
    fs.writeFileSync(path.join(tempDir, 'package.json'), '{}');
    const agentsDir = path.join(tempDir, '.agents');
    fs.mkdirSync(agentsDir);
    const rulesDir = path.join(agentsDir, 'rules');
    fs.mkdirSync(rulesDir, { recursive: true });

    // Create a file that already exists
    const targetFile = path.join(rulesDir, 'existing.md');
    fs.writeFileSync(targetFile, 'Old content');

    // Decline overwrite
    vi.mocked(clackPrompts.confirm).mockResolvedValueOnce(false);

    await addRule('existing', tempDir);

    expect(clackPrompts.outro).toHaveBeenCalledWith(expect.stringContaining('Aborted'));
    expect(fs.readFileSync(targetFile, 'utf-8')).toBe('Old content');
  });

  it('should prompt to overwrite if the rule already exists and overwrite if confirmed', async () => {
    // Setup root with .agents
    fs.writeFileSync(path.join(tempDir, 'package.json'), '{}');
    const agentsDir = path.join(tempDir, '.agents');
    fs.mkdirSync(agentsDir);
    const rulesDir = path.join(agentsDir, 'rules');
    fs.mkdirSync(rulesDir, { recursive: true });

    // Create a file that already exists
    const targetFile = path.join(rulesDir, 'existing.md');
    fs.writeFileSync(targetFile, 'Old content');

    // Confirm overwrite
    vi.mocked(clackPrompts.confirm).mockResolvedValueOnce(true);
    vi.mocked(clackPrompts.text).mockResolvedValueOnce('New rules');

    await addRule('existing', tempDir);

    expect(fs.readFileSync(targetFile, 'utf-8')).toContain('New rules');
    expect(fs.readFileSync(targetFile, 'utf-8')).toContain('# existing');
  });
});
