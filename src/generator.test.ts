import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateConfig } from './generator';
import fs from 'fs';
import path from 'path';
import os from 'os';
import * as clackPrompts from '@clack/prompts';

vi.mock('@clack/prompts', () => ({
  select: vi.fn(),
  isCancel: vi.fn((val) => val === Symbol.for('cancel')),
}));

describe('generator', () => {
  let tempDir: string;

  beforeEach(() => {
    // Create a temporary directory for each test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'create-code-buddy-test-'));
  });

  afterEach(() => {
    // Clean up the temporary directory after each test
    fs.rmSync(tempDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('should generate gemini config files correctly with minimization', async () => {
    await generateConfig({
      framework: 'nextjs',
      agent: 'gemini',
      addToGitignore: false,
      options: { router: 'app' }
    }, tempDir);

    const geminiDir = path.join(tempDir, '.agents');
    expect(fs.existsSync(geminiDir)).toBe(true);
    
    // For gemini, it uses AGENTS.md
    expect(fs.existsSync(path.join(geminiDir, 'AGENTS.md'))).toBe(true);
    const content = fs.readFileSync(path.join(geminiDir, 'AGENTS.md'), 'utf8');
    expect(content).toContain('SAFE TO EDIT');
    expect(content).toContain('PROGRESSIVE DISCLOSURE ACTIVE');
    
    // Check if EJS rendered correctly
    const archContent = fs.readFileSync(path.join(geminiDir, 'rules', 'architecture.md'), 'utf8');
    expect(archContent).toContain('src/app');
    
    // It creates specs folder
    expect(fs.existsSync(path.join(geminiDir, 'specs', 'spec.md'))).toBe(true);
  });

  it('should generate laravel templates correctly with options', async () => {
    await generateConfig({
      framework: 'laravel',
      agent: 'cursor',
      addToGitignore: false,
      options: { frontend: 'inertia-svelte', testing: 'pest' }
    }, tempDir);

    const cursorDir = path.join(tempDir, '.cursor/rules');
    expect(fs.existsSync(cursorDir)).toBe(true);

    const archContent = fs.readFileSync(path.join(cursorDir, 'architecture.mdc'), 'utf8');
    expect(archContent).toContain('Inertia.js with Svelte');
    
    const testingContent = fs.readFileSync(path.join(cursorDir, 'testing.mdc'), 'utf8');
    expect(testingContent).toContain('Pest PHP');
  });

  it('should generate nodejs templates correctly with options', async () => {
    await generateConfig({
      framework: 'nodejs',
      agent: 'generic',
      addToGitignore: false,
      options: { architecture: 'nestjs', language: 'typescript' }
    }, tempDir);

    const genericDir = path.join(tempDir, 'agent-config', 'rules');
    
    const archContent = fs.readFileSync(path.join(genericDir, 'architecture.md'), 'utf8');
    expect(archContent).toContain('NestJS');
    
    const convContent = fs.readFileSync(path.join(genericDir, 'conventions.md'), 'utf8');
    expect(convContent).toContain('TypeScript');
  });

  it('should generate csharp-dotnet templates correctly with options', async () => {
    await generateConfig({
      framework: 'csharp-dotnet',
      agent: 'gemini',
      addToGitignore: false,
      options: { architecture: 'minimal' }
    }, tempDir);

    const geminiDir = path.join(tempDir, '.agents', 'rules');
    
    const archContent = fs.readFileSync(path.join(geminiDir, 'architecture.md'), 'utf8');
    expect(archContent).toContain('Minimal APIs');
  });

  it('should generate cursor rules with targeted globs by default', async () => {
    await generateConfig({
      framework: 'nextjs',
      agent: 'cursor',
      addToGitignore: false,
      options: { router: 'pages' }
    }, tempDir);

    const cursorDir = path.join(tempDir, '.cursor/rules');
    expect(fs.existsSync(cursorDir)).toBe(true);
    
    const testingMdcPath = path.join(cursorDir, 'testing.mdc');
    expect(fs.existsSync(testingMdcPath)).toBe(true);
    
    const testingContent = fs.readFileSync(testingMdcPath, 'utf8');
    expect(testingContent).toContain('globs: ["*.test.*", "*.spec.*", "**/__tests__/**"]');

    const archContent = fs.readFileSync(path.join(cursorDir, 'architecture.mdc'), 'utf8');
    expect(archContent).toContain('src/pages');
  });

  it('should revert to global globs if disableMinimizer is true', async () => {
    await generateConfig({
      framework: 'nextjs',
      agent: 'cursor',
      addToGitignore: false,
      options: {}
    }, tempDir, true); // disableMinimizer = true

    const cursorDir = path.join(tempDir, '.cursor/rules');
    const testingMdcPath = path.join(cursorDir, 'testing.mdc');
    
    const testingContent = fs.readFileSync(testingMdcPath, 'utf8');
    expect(testingContent).toContain('globs: ["*.*"]');
    expect(testingContent).not.toContain('*.test.*');
  });

  it('should respect skip option when file already exists', async () => {
    const geminiDir = path.join(tempDir, '.agents');
    fs.mkdirSync(geminiDir, { recursive: true });
    fs.writeFileSync(path.join(geminiDir, 'AGENTS.md'), 'Original Content');

    vi.mocked(clackPrompts.select).mockResolvedValue('skip');

    await generateConfig({
      framework: 'laravel',
      agent: 'gemini',
      addToGitignore: false,
      options: {}
    }, tempDir);

    const content = fs.readFileSync(path.join(geminiDir, 'AGENTS.md'), 'utf8');
    expect(content).toBe('Original Content');
    expect(clackPrompts.select).toHaveBeenCalled();
  });

  it('should respect overwrite option when file already exists', async () => {
    const geminiDir = path.join(tempDir, '.agents');
    fs.mkdirSync(geminiDir, { recursive: true });
    fs.writeFileSync(path.join(geminiDir, 'AGENTS.md'), 'Original Content');

    vi.mocked(clackPrompts.select).mockResolvedValue('overwrite');

    await generateConfig({
      framework: 'laravel',
      agent: 'gemini',
      addToGitignore: false,
      options: {}
    }, tempDir);

    const content = fs.readFileSync(path.join(geminiDir, 'AGENTS.md'), 'utf8');
    expect(content).toContain('SAFE TO EDIT');
  });
});
