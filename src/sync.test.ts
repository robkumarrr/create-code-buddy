import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';
import { syncAgents, updateGitignore } from './sync';
import { WATERMARK } from './core/constants';
import {
  makeWorkspace,
  cleanupWorkspaces,
  seedProject,
  ruleFile,
  readFile,
  writeFile,
  exists,
  tree,
  readFrontmatter,
  splitFile,
} from './test/workspace';

/**
 * The executable specification for the rule compiler.
 *
 * Format expectations here are ground truth, verified against each agent's own
 * documented format and against what the wider ecosystem actually emits
 * (checked 2026-09-15). Where our output differs from this file, our output is
 * what is wrong.
 *
 * Tests marked `it.fails` describe behavior we have specified but not yet
 * implemented. `it.fails` asserts the test currently fails, so the suite stays
 * green — and the moment the underlying bug is fixed, the marker itself starts
 * failing, forcing whoever fixed it to promote the test to a plain `it`.
 * That keeps "green suite" a trustworthy signal all the way through the
 * refactor. Do not delete these to get green; do not leave the branch red.
 *
 * PHASE 2 (adapter registry, complete): flipped two tests, both promoted —
 * block-list globs (adapters now consume Rule.globs from the real parser
 * instead of the old line-splitter), and the deselected-agent GC fix, which
 * Task 2.4's full-registry iteration produced as a direct side effect.
 * PHASE 3 (targeted format fixes): everything else still marked `it.fails`.
 */

const MULTI_GLOB = ruleFile('Testing standards', ['*.test.ts', '*.spec.ts'], '# Testing\n\nUse vitest.');
const SINGLE_GLOB = ruleFile('Typescript conventions', ['*.ts'], '# Conventions');
const UNIVERSAL = ruleFile('Architecture', ['*.*'], '# Architecture');

let exitCodeBefore: typeof process.exitCode;

beforeEach(() => {
  exitCodeBefore = process.exitCode;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  // A leaked non-zero exitCode would poison the whole vitest run.
  process.exitCode = exitCodeBefore;
  vi.restoreAllMocks();
  cleanupWorkspaces();
});

describe('format fidelity', () => {
  it.fails('cursor: writes .mdc with a bare comma-joined globs line', async () => {
    const root = makeWorkspace();
    seedProject(root, { agents: ['cursor'], rules: { 'testing.md': MULTI_GLOB } });

    await syncAgents(root);

    const contents = readFile(root, '.cursor/rules/testing.mdc');
    const { frontmatter } = splitFile(contents);

    // NOTE: Cursor's .mdc frontmatter is deliberately NOT strict YAML —
    // `globs: *.ts` is an unresolved alias to a YAML parser. Cursor reads it
    // with its own lenient parser, and the ecosystem emits the bare form.
    // This is the ONE adapter exempt from the valid-YAML rule. Do not "fix"
    // it by quoting the globs; the quotes end up inside the pattern.
    expect(frontmatter).toContain('description: Testing standards');
    expect(frontmatter).toContain('globs: *.test.ts,*.spec.ts');
    expect(contents).toContain(WATERMARK);
  });

  it.fails('cursor: emits alwaysApply for a universal rule', async () => {
    const root = makeWorkspace();
    seedProject(root, { agents: ['cursor'], rules: { 'architecture.md': UNIVERSAL } });

    await syncAgents(root);

    expect(splitFile(readFile(root, '.cursor/rules/architecture.mdc')).frontmatter).toContain(
      'alwaysApply: true',
    );
  });

  it.fails('copilot: applyTo is one comma-joined string, and the file is valid YAML', async () => {
    const root = makeWorkspace();
    seedProject(root, { agents: ['copilot'], rules: { 'testing.md': MULTI_GLOB } });

    await syncAgents(root);

    const fm = readFrontmatter(root, '.github/instructions/testing.instructions.md');
    expect(fm.applyTo).toBe('*.test.ts,*.spec.ts');
    expect(fm.description).toBe('Testing standards');
  });

  it('copilot: single-glob output is valid YAML (the case the old suite tested)', async () => {
    const root = makeWorkspace();
    seedProject(root, { agents: ['copilot'], rules: { 'conventions.md': SINGLE_GLOB } });

    await syncAgents(root);

    const fm = readFrontmatter(root, '.github/instructions/conventions.instructions.md');
    expect(fm.applyTo).toBe('*.ts');
  });

  it('cline: targeted rules use a paths block list', async () => {
    const root = makeWorkspace();
    seedProject(root, { agents: ['cline'], rules: { 'testing.md': MULTI_GLOB } });

    await syncAgents(root);

    // NOTE: the `**/` prefix is added by our Cline adapter alone; the wider
    // ecosystem passes globs through verbatim. That inconsistency is an open
    // maintainer decision (plan task 3.9) — if it is resolved in favour of
    // passthrough, update this expectation to ['*.test.ts', '*.spec.ts'].
    const fm = readFrontmatter(root, '.clinerules/testing.md');
    expect(fm.paths).toEqual(['**/*.test.ts', '**/*.spec.ts']);
  });

  it('cline: always-on rules carry no frontmatter', async () => {
    const root = makeWorkspace();
    seedProject(root, { agents: ['cline'], rules: { 'architecture.md': UNIVERSAL } });

    await syncAgents(root);

    const contents = readFile(root, '.clinerules/architecture.md');
    expect(splitFile(contents).frontmatter).toBeNull();
    expect(contents).toContain(WATERMARK);
  });

  it.fails('claude: targeted rules use a paths block list', async () => {
    const root = makeWorkspace();
    seedProject(root, { agents: ['claude'], rules: { 'testing.md': MULTI_GLOB } });

    await syncAgents(root);

    const fm = readFrontmatter(root, '.claude/rules/testing.md');
    expect(fm.paths).toEqual(['*.test.ts', '*.spec.ts']);
  });

  it.each([
    ['gemini', '.agents/rules/testing.md'],
    ['windsurf', '.windsurf/rules/testing.md'],
    ['claude', '.claude/rules/testing.md'],
  ])('%s: multi-glob output parses as valid YAML', async (agent, outputPath) => {
    const root = makeWorkspace();
    seedProject(root, { agents: [agent], rules: { 'testing.md': MULTI_GLOB } });

    await syncAgents(root);

    expect(() => readFrontmatter(root, outputPath)).not.toThrow();
  });

  it('every adapter preserves the rule body verbatim', async () => {
    const root = makeWorkspace();
    const body = '# Testing\n\nUse vitest.\n\n---\n\nEven across a horizontal rule.';
    seedProject(root, {
      agents: ['cursor', 'claude', 'cline', 'copilot', 'gemini', 'windsurf'],
      rules: { 'testing.md': ruleFile('Testing standards', ['*.test.ts'], body) },
    });

    await syncAgents(root);

    for (const file of [
      '.cursor/rules/testing.mdc',
      '.claude/rules/testing.md',
      '.clinerules/testing.md',
      '.github/instructions/testing.instructions.md',
      '.agents/rules/testing.md',
      '.windsurf/rules/testing.md',
    ]) {
      expect(readFile(root, file), file).toContain('Even across a horizontal rule.');
    }
  });

  it('a YAML block list survives the round trip as a targeted rule', async () => {
    const root = makeWorkspace();
    seedProject(root, {
      agents: ['cline'],
      rules: {
        'testing.md': '---\ndescription: Testing\nglobs:\n  - "*.test.ts"\n  - "*.spec.ts"\n---\n\n# Testing',
      },
    });

    await syncAgents(root);

    // Promoted from it.fails in Phase 2: adapters now consume Rule.globs from
    // core/rule.ts's real YAML parser instead of the old line-splitting one,
    // which read this exact shape as an empty string and silently compiled
    // the rule as always-on, applied to every file in the repo.
    const fm = readFrontmatter(root, '.clinerules/testing.md');
    expect(fm.paths).toBeDefined();
  });

  it('a YAML block list resolves to the exact glob patterns it names', async () => {
    // A new, separate test rather than tightening the assertion above —
    // editing an existing expectation to fit new behavior is exactly what
    // the acceptance gate for this phase forbids (docs/V1-HARDENING-PLAN.md
    // Task 2.6, gate 4).
    const root = makeWorkspace();
    seedProject(root, {
      agents: ['cline'],
      rules: {
        'testing.md': '---\ndescription: Testing\nglobs:\n  - "*.test.ts"\n  - "*.spec.ts"\n---\n\n# Testing',
      },
    });

    await syncAgents(root);

    const fm = readFrontmatter(root, '.clinerules/testing.md');
    expect(fm.paths).toEqual(['**/*.test.ts', '**/*.spec.ts']);
  });

  it.fails('gemini: compiles the system rule as a native skill', async () => {
    const root = makeWorkspace();
    seedProject(root, {
      agents: ['gemini'],
      rules: { 'codebuddy-system.md': ruleFile('System instructions', ['*.*'], '# System') },
    });

    await syncAgents(root);

    // Shipped once, then silently dropped when Gemini output moved to
    // .agents/rules/ (plan task 3.11). Nothing guarded it, so the regression was
    // invisible; the orphaned file is still sitting in this repo's own .agents/.
    expect(exists(root, '.agents/skills/codebuddy-system/SKILL.md')).toBe(true);
    expect(readFile(root, '.agents/skills/codebuddy-system/SKILL.md')).toContain(WATERMARK);
  });

  it.fails('gemini: collects orphans left in the pre-refactor locations', async () => {
    const root = makeWorkspace();
    seedProject(root, { agents: ['gemini'], rules: { 'testing.md': MULTI_GLOB } });

    // Legacy layout: rules sat directly in .agents/ before they moved to
    // .agents/rules/. Existing users still have these, and the collector cannot
    // see them because it only scans the new location.
    writeFile(root, '.agents/architecture.md', `${WATERMARK}\n# Stale orphan`);
    writeFile(root, '.agents/mine.md', '# Hand written, must survive');

    await syncAgents(root);

    expect(exists(root, '.agents/architecture.md')).toBe(false);
    expect(exists(root, '.agents/mine.md')).toBe(true);
  });

  it('nested rules keep their directory structure', async () => {
    const root = makeWorkspace();
    seedProject(root, {
      agents: ['cursor', 'copilot'],
      rules: { 'backend/database.md': SINGLE_GLOB },
    });

    await syncAgents(root);

    expect(exists(root, '.cursor/rules/backend/database.mdc')).toBe(true);
    expect(exists(root, '.github/instructions/backend/database.instructions.md')).toBe(true);
  });
});

describe('lifecycle', () => {
  it('garbage-collects a compiled rule when its source is deleted', async () => {
    const root = makeWorkspace();
    seedProject(root, {
      agents: ['cursor', 'claude'],
      rules: { 'testing.md': MULTI_GLOB, 'conventions.md': SINGLE_GLOB },
    });
    await syncAgents(root);
    expect(exists(root, '.cursor/rules/testing.mdc')).toBe(true);

    require('fs').unlinkSync(path.join(root, '.codebuddy/testing.md'));
    await syncAgents(root);

    expect(exists(root, '.cursor/rules/testing.mdc')).toBe(false);
    expect(exists(root, '.claude/rules/testing.md')).toBe(false);
    expect(exists(root, '.cursor/rules/conventions.mdc')).toBe(true);
  });

  it('never deletes a hand-written file that has no watermark', async () => {
    const root = makeWorkspace();
    seedProject(root, { agents: ['cursor'], rules: { 'testing.md': MULTI_GLOB } });
    writeFile(root, '.cursor/rules/my-own.mdc', '# Mine\n\nNot generated, do not touch.');

    await syncAgents(root);
    require('fs').unlinkSync(path.join(root, '.codebuddy/testing.md'));
    await syncAgents(root);

    expect(exists(root, '.cursor/rules/my-own.mdc')).toBe(true);
    expect(readFile(root, '.cursor/rules/my-own.mdc')).toContain('do not touch');
  });

  it('is idempotent — a second sync changes nothing', async () => {
    const root = makeWorkspace();
    seedProject(root, {
      agents: ['cursor', 'claude', 'cline', 'copilot'],
      rules: { 'testing.md': MULTI_GLOB, 'backend/db.md': SINGLE_GLOB },
    });

    await syncAgents(root);
    const first = tree(root).map((f) => [f, readFile(root, f)] as const);

    await syncAgents(root);
    const second = tree(root).map((f) => [f, readFile(root, f)] as const);

    expect(second).toEqual(first);
  });

  it('removes a deselected agent\'s compiled folder on the next sync', async () => {
    const root = makeWorkspace();
    seedProject(root, {
      agents: ['cursor', 'cline'],
      rules: { 'testing.md': MULTI_GLOB },
    });
    await syncAgents(root);
    expect(exists(root, '.clinerules/testing.md')).toBe(true);

    seedProject(root, { agents: ['cursor'], rules: { 'testing.md': MULTI_GLOB } });
    await syncAgents(root);

    // Promoted from it.fails in Phase 2. Before Task 2.4's rewrite, these
    // files survived AND lost their .gitignore entry, so stale generated
    // rules became newly visible to git and got committed as if they were
    // hand-authored — the exact failure this tool exists to prevent. Fixed by
    // iterating every adapter on every sync, active or not, so a deselected
    // one's own previously compiled files always register as orphans.
    expect(exists(root, '.clinerules/testing.md')).toBe(false);
  });
});

describe('gitignore', () => {
  it('injects a managed block into an existing .gitignore', async () => {
    const root = makeWorkspace({ '.gitignore': 'node_modules/\n' });
    seedProject(root, { agents: ['cursor'], rules: { 'testing.md': MULTI_GLOB } });

    await syncAgents(root);

    const contents = readFile(root, '.gitignore');
    expect(contents).toContain('node_modules/');
    expect(contents).toContain('# --- Create Code Buddy (Start) ---');
    expect(contents).toContain('# --- Create Code Buddy (End) ---');
  });

  it('does not duplicate the managed block across repeated syncs', async () => {
    const root = makeWorkspace({ '.gitignore': 'node_modules/\n' });
    seedProject(root, { agents: ['cursor'], rules: { 'testing.md': MULTI_GLOB } });

    await syncAgents(root);
    await syncAgents(root);
    await syncAgents(root);

    const occurrences = readFile(root, '.gitignore').split('# --- Create Code Buddy (Start) ---').length - 1;
    expect(occurrences).toBe(1);
  });

  it('leaves user content outside the managed block untouched', () => {
    const root = makeWorkspace({ '.gitignore': 'node_modules/\ndist/\n.env\n' });

    updateGitignore(root, ['.cursor/rules/']);
    updateGitignore(root, [], true);

    const contents = readFile(root, '.gitignore');
    expect(contents).toContain('node_modules/');
    expect(contents).toContain('dist/');
    expect(contents).toContain('.env');
    expect(contents).not.toContain('Create Code Buddy');
  });

  it.fails('scopes ignore entries to generated rule directories only', async () => {
    const root = makeWorkspace({ '.gitignore': 'node_modules/\n' });
    seedProject(root, {
      agents: ['claude', 'cursor', 'windsurf'],
      rules: { 'testing.md': MULTI_GLOB },
    });

    await syncAgents(root);
    const contents = readFile(root, '.gitignore');

    // Ignoring `.claude/` wholesale silently stops tracking the user's own
    // settings.json, custom commands and skills. Copilot's entry is already
    // correctly scoped; every adapter should match it.
    expect(contents).toContain('.claude/rules/');
    expect(contents).not.toMatch(/^\.claude\/$/m);
    expect(contents).not.toMatch(/^\.cursor\/$/m);
    expect(contents).not.toMatch(/^\.windsurf\/$/m);
  });

  it('drops the ignore entry for a deselected agent', async () => {
    const root = makeWorkspace({ '.gitignore': 'node_modules/\n' });
    seedProject(root, { agents: ['cursor', 'cline'], rules: { 'testing.md': MULTI_GLOB } });
    await syncAgents(root);
    expect(readFile(root, '.gitignore')).toContain('.clinerules/');

    seedProject(root, { agents: ['cursor'], rules: { 'testing.md': MULTI_GLOB } });
    await syncAgents(root);

    // This half already works. It is the other half that is dangerous: the
    // compiled files survive (see the deselect test in `lifecycle`), so losing
    // the ignore entry is what makes stale generated rules newly visible to
    // git. Keep this green so the Phase 2 rewrite cannot regress it.
    expect(readFile(root, '.gitignore')).not.toContain('.clinerules/');
  });

  it('writes no ignore block when the user opted out', async () => {
    const root = makeWorkspace({ '.gitignore': 'node_modules/\n' });
    seedProject(root, {
      agents: ['cursor'],
      gitignore: false,
      rules: { 'testing.md': MULTI_GLOB },
    });

    await syncAgents(root);

    expect(readFile(root, '.gitignore')).not.toContain('Create Code Buddy');
  });
});

describe('failure modes', () => {
  it.fails('sets a non-zero exit code when there is no config', async () => {
    const root = makeWorkspace();

    await syncAgents(root);

    // Every error path currently returns silently with exit code 0, so nothing
    // is detectable in CI — and we recommend wiring sync into postinstall.
    expect(process.exitCode).toBe(1);
  });

  it('does not write anything when there is no config', async () => {
    const root = makeWorkspace();
    await syncAgents(root);
    expect(tree(root)).toEqual([]);
  });

  it('one malformed rule does not prevent the others compiling', async () => {
    const root = makeWorkspace();
    seedProject(root, {
      agents: ['copilot'],
      rules: {
        'broken.md': '---\napplyTo: "*.ts", "*.js"\nglobs: [unclosed\n---\n\n# Broken',
        'good.md': SINGLE_GLOB,
      },
    });

    await syncAgents(root);

    expect(exists(root, '.github/instructions/good.instructions.md')).toBe(true);
    expect(readFrontmatter(root, '.github/instructions/good.instructions.md').applyTo).toBe('*.ts');
  });

  it('tolerates an unknown agent id without writing stray files', async () => {
    const root = makeWorkspace();
    seedProject(root, { agents: ['notanagent'], rules: { 'testing.md': MULTI_GLOB } });

    await syncAgents(root);

    expect(tree(root, '.cursor')).toEqual([]);
    expect(tree(root, '.claude')).toEqual([]);
  });
});
