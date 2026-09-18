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
 * If a behavior here is specified but not yet built, mark it `it.fails` rather
 * than deleting it or leaving the branch red: that asserts the test currently
 * fails, so the suite stays green, and the marker itself starts failing the
 * moment the gap is closed — which forces it back to a plain `it`.
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
  it('cursor: writes .mdc with a bare comma-joined globs line', async () => {
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

  it('cursor: emits alwaysApply for a universal rule', async () => {
    const root = makeWorkspace();
    seedProject(root, { agents: ['cursor'], rules: { 'architecture.md': UNIVERSAL } });

    await syncAgents(root);

    expect(splitFile(readFile(root, '.cursor/rules/architecture.mdc')).frontmatter).toContain(
      'alwaysApply: true',
    );
  });

  it('copilot: applyTo is one comma-joined string, and the file is valid YAML', async () => {
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

    // Task 3.9 resolved in favour of passthrough, verified against Cline's
    // own docs: "an array of glob patterns" matched as written, no
    // documented prefixing convention. Was ['**/*.test.ts', '**/*.spec.ts'].
    const fm = readFrontmatter(root, '.clinerules/testing.md');
    expect(fm.paths).toEqual(['*.test.ts', '*.spec.ts']);
  });

  it('cline: always-on rules carry no frontmatter', async () => {
    const root = makeWorkspace();
    seedProject(root, { agents: ['cline'], rules: { 'architecture.md': UNIVERSAL } });

    await syncAgents(root);

    const contents = readFile(root, '.clinerules/architecture.md');
    expect(splitFile(contents).frontmatter).toBeNull();
    expect(contents).toContain(WATERMARK);
  });

  it('claude: targeted rules use a paths block list', async () => {
    const root = makeWorkspace();
    seedProject(root, { agents: ['claude'], rules: { 'testing.md': MULTI_GLOB } });

    await syncAgents(root);

    const fm = readFrontmatter(root, '.claude/rules/testing.md');
    expect(fm.paths).toEqual(['*.test.ts', '*.spec.ts']);
  });

  it.each([
    ['gemini', '.agents/rules/testing.md'],
    ['claude', '.claude/rules/testing.md'],
  ])('%s: multi-glob output parses as valid YAML', async (agent, outputPath) => {
    const root = makeWorkspace();
    seedProject(root, { agents: [agent], rules: { 'testing.md': MULTI_GLOB } });

    await syncAgents(root);

    expect(() => readFrontmatter(root, outputPath)).not.toThrow();
  });

  it('windsurf: writes a bare comma-joined globs line with trigger: glob', async () => {
    const root = makeWorkspace();
    seedProject(root, { agents: ['windsurf'], rules: { 'testing.md': MULTI_GLOB } });

    await syncAgents(root);

    const contents = readFile(root, '.windsurf/rules/testing.md');
    const { frontmatter } = splitFile(contents);

    // NOT run through readFrontmatter/YAML.parse deliberately: a pattern
    // starting with two asterisks is YAML alias syntax, so — like Cursor's
    // own globs line — this is not strict YAML. Confirmed against Devin
    // Desktop's docs (docs.windsurf.com now redirects there; Windsurf
    // rebranded, .windsurf/rules/ is the documented, still-supported
    // fallback location). Do not "fix" this by quoting the globs.
    expect(frontmatter).toContain('trigger: glob');
    expect(frontmatter).toContain('description: Testing standards');
    expect(frontmatter).toContain('globs: *.test.ts,*.spec.ts');
    expect(contents).toContain(WATERMARK);
  });

  it('windsurf: always-on rules use trigger: always_on and are valid YAML', async () => {
    const root = makeWorkspace();
    seedProject(root, { agents: ['windsurf'], rules: { 'architecture.md': UNIVERSAL } });

    await syncAgents(root);

    // Unlike the targeted case above, there's no globs field here to break
    // YAML-ness, so this one IS checked with a real parse.
    const fm = readFrontmatter(root, '.windsurf/rules/architecture.md');
    expect(fm.trigger).toBe('always_on');
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
    // Task 2.6, gate 4). Updated for Task 3.9's resolution in favour of
    // passthrough (was ['**/*.test.ts', '**/*.spec.ts']) -- this assertion
    // tracks that same decision, made after this test was first written.
    const root = makeWorkspace();
    seedProject(root, {
      agents: ['cline'],
      rules: {
        'testing.md': '---\ndescription: Testing\nglobs:\n  - "*.test.ts"\n  - "*.spec.ts"\n---\n\n# Testing',
      },
    });

    await syncAgents(root);

    const fm = readFrontmatter(root, '.clinerules/testing.md');
    expect(fm.paths).toEqual(['*.test.ts', '*.spec.ts']);
  });

  it('gemini: writes one copy of each rule and no skill', async () => {
    const root = makeWorkspace();
    seedProject(root, {
      agents: ['gemini'],
      rules: { 'codebuddy-system.md': ruleFile('System instructions', ['*.*'], '# System') },
    });

    await syncAgents(root);

    // This rule used to compile twice for Gemini alone -- once here, and again
    // as a native Skill. `.agents/rules/` is the location Antigravity
    // documents, so the Skill was a second copy of content the agent already
    // had, produced by matching one hardcoded filename.
    expect(exists(root, '.agents/rules/codebuddy-system.md')).toBe(true);
    expect(exists(root, '.agents/skills/codebuddy-system/SKILL.md')).toBe(false);
    expect(tree(root, '.agents')).toEqual(['.agents/rules/codebuddy-system.md']);
  });

  it('gemini: collects orphans left in the pre-refactor locations', async () => {
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

  it('sweeps a skill left behind by an older version, folder and all', async () => {
    const root = makeWorkspace();
    seedProject(root, {
      agents: ['gemini'],
      rules: { 'codebuddy-system.md': ruleFile('System instructions', ['*.*'], '# System') },
    });
    // Exactly what upgrading from a version that still wrote the skill looks
    // like on disk.
    writeFile(root, '.agents/skills/codebuddy-system/SKILL.md', `${WATERMARK}\n# System`);

    await syncAgents(root);

    expect(exists(root, '.agents/skills/codebuddy-system/SKILL.md')).toBe(false);
    // Deleting the file and leaving its folders would hand every existing user
    // empty directories to wonder about. `.agents/skills` goes too: unlike a
    // rulesDir, nothing will ever write there again.
    expect(exists(root, '.agents/skills/codebuddy-system')).toBe(false);
    expect(exists(root, '.agents/skills')).toBe(false);
    expect(exists(root, '.agents/rules/codebuddy-system.md')).toBe(true);
  });

  it('sweeps that skill even when gemini is no longer a selected agent', async () => {
    const root = makeWorkspace();
    seedProject(root, { agents: ['cursor'], rules: { 'testing.md': MULTI_GLOB } });
    writeFile(root, '.agents/skills/codebuddy-system/SKILL.md', `${WATERMARK}\n# System`);

    await syncAgents(root);

    // An abandoned output location is abandoned whether or not the agent that
    // made it is still selected -- otherwise deselecting gemini would pin the
    // orphan in place forever.
    expect(exists(root, '.agents/skills/codebuddy-system/SKILL.md')).toBe(false);
  });

  it('never deletes a hand-written file living in .agents/skills', async () => {
    const root = makeWorkspace();
    seedProject(root, {
      agents: ['gemini'],
      rules: { 'codebuddy-system.md': ruleFile('System instructions', ['*.*'], '# System') },
    });
    writeFile(root, '.agents/skills/mine/SKILL.md', '# My own skill, not generated');
    writeFile(root, '.agents/skills/codebuddy-system/SKILL.md', `${WATERMARK}\n# System`);

    await syncAgents(root);

    // The sweep now clears this whole directory of watermarked files, so the
    // watermark check is the only thing standing between it and a user's own
    // skills. Worth pinning with the sweep running right next door.
    expect(exists(root, '.agents/skills/mine/SKILL.md')).toBe(true);
    expect(exists(root, '.agents/skills/codebuddy-system/SKILL.md')).toBe(false);
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

    require('fs').unlinkSync(path.join(root, '.codebuddy/rules/testing.md'));
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
    require('fs').unlinkSync(path.join(root, '.codebuddy/rules/testing.md'));
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

  it('scopes ignore entries to generated rule directories only', async () => {
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

describe('specs are indexed, never compiled', () => {
  const SPEC = '---\ndescription: MCP server\nstatus: in progress\n---\n\n# MCP\n\nDetails.';

  it('lists a spec in AGENTS.md with its status', async () => {
    const root = makeWorkspace();
    seedProject(root, {
      agents: ['cursor'],
      rules: { 'testing.md': MULTI_GLOB },
      specs: { 'mcp-server.md': SPEC },
    });

    await syncAgents(root);

    const agentsMd = readFile(root, 'AGENTS.md');
    expect(agentsMd).toContain('.codebuddy/specs/mcp-server.md');
    expect(agentsMd).toContain('MCP server');
    expect(agentsMd).toContain('in progress');
  });

  it('never copies a spec into any agent folder', async () => {
    const root = makeWorkspace();
    seedProject(root, {
      agents: ['cursor', 'claude', 'cline', 'copilot', 'gemini', 'windsurf'],
      rules: { 'testing.md': MULTI_GLOB },
      specs: { 'mcp-server.md': SPEC },
    });

    await syncAgents(root);

    // The whole point: the spec body stays in one place instead of being
    // duplicated six times and injected regardless of relevance.
    const everythingCompiled = tree(root)
      .filter((f) => !f.startsWith('.codebuddy/') && f !== 'AGENTS.md')
      .map((f) => readFile(root, f))
      .join('\n');
    expect(everythingCompiled).not.toContain('Details.');
    expect(tree(root).filter((f) => f.includes('mcp-server'))).toEqual([
      '.codebuddy/specs/mcp-server.md',
    ]);
  });

  it('omits the specs section entirely when there are none', async () => {
    const root = makeWorkspace();
    seedProject(root, { agents: ['cursor'], rules: { 'testing.md': MULTI_GLOB } });

    await syncAgents(root);

    expect(readFile(root, 'AGENTS.md')).not.toContain('Project specs');
  });

  it('warns when rules are still loose at the SSOT root, and names migrate', async () => {
    const root = makeWorkspace();
    seedProject(root, { agents: ['cursor'], rules: { 'testing.md': MULTI_GLOB } });
    // The pre-rules/ layout, with no compiled output to trip the wipe guard --
    // exactly what a fresh clone looks like, since the agent folders are
    // gitignored by default and never committed.
    writeFile(root, '.codebuddy/architecture.md', '---\ndescription: Arch\n---\n\n# Arch');

    const logged: string[] = [];
    vi.mocked(console.log).mockImplementation((msg?: unknown) => {
      logged.push(String(msg));
    });

    await syncAgents(root);

    const output = logged.join('\n');
    expect(output).toContain('architecture.md');
    expect(output).toContain('migrate');
  });

  it('does not mistake config.json for a stranded rule', async () => {
    const root = makeWorkspace();
    seedProject(root, { agents: ['cursor'], rules: { 'testing.md': MULTI_GLOB } });

    const logged: string[] = [];
    vi.mocked(console.log).mockImplementation((msg?: unknown) => {
      logged.push(String(msg));
    });

    await syncAgents(root);

    // config.json lives at the SSOT root by design. Warning about it would
    // fire on every correctly-laid-out project there is.
    expect(logged.join('\n')).not.toContain('migrate');
  });

  it('does not call a run that compiled nothing a success', async () => {
    const root = makeWorkspace();
    seedProject(root, { agents: ['cursor'], rules: {} });

    const logged: string[] = [];
    vi.mocked(console.log).mockImplementation((msg?: unknown) => {
      logged.push(String(msg));
    });

    await syncAgents(root);

    // `✔ Compiled 0 rules` reads as success for a run that did nothing. The
    // tick is reserved for runs that actually wrote something.
    const output = logged.join('\n');
    expect(output).not.toContain('✔ Compiled 0 rules');
    expect(output).toContain('No rules to compile');
  });

  it('warns about a folder it does not recognize instead of ignoring it', async () => {
    const root = makeWorkspace();
    seedProject(root, { agents: ['cursor'], rules: { 'testing.md': MULTI_GLOB } });
    writeFile(root, '.codebuddy/prompts/thing.md', '# Not a rule');

    const logged: string[] = [];
    vi.mocked(console.log).mockImplementation((msg?: unknown) => {
      logged.push(String(msg));
    });

    await syncAgents(root);

    expect(logged.join('\n')).toContain('prompts');
    // And it is definitely not compiled.
    expect(exists(root, '.cursor/rules/thing.mdc')).toBe(false);
  });
});

describe('cleanup tidies up after itself', () => {
  it('removes the directory left empty by de-compiling a nested rule', async () => {
    const root = makeWorkspace();
    seedProject(root, {
      agents: ['cursor'],
      rules: { 'testing.md': MULTI_GLOB, 'backend/database.md': SINGLE_GLOB },
    });
    await syncAgents(root);
    expect(exists(root, '.cursor/rules/backend/database.mdc')).toBe(true);

    require('fs').rmSync(require('path').join(root, '.codebuddy/rules/backend'), {
      recursive: true,
    });
    await syncAgents(root);

    // Leaving an empty `backend/` behind in all six agent trees is litter the
    // user has to wonder about.
    expect(exists(root, '.cursor/rules/backend')).toBe(false);
    expect(exists(root, '.cursor/rules/testing.mdc')).toBe(true);
  });
});

describe('refuses to wipe everything (safety guard)', () => {
  it('stops instead of deleting all output when every source rule is gone', async () => {
    const root = makeWorkspace();
    seedProject(root, { agents: ['cursor', 'claude', 'cline'], rules: { 'testing.md': MULTI_GLOB } });
    await syncAgents(root);
    expect(exists(root, '.cursor/rules/testing.mdc')).toBe(true);

    // Simulates the two ways this happens in practice: an accidental delete,
    // or an upgrade where the tool starts looking somewhere the rules aren't.
    require('fs').rmSync(require('path').join(root, '.codebuddy/rules/testing.md'));

    await syncAgents(root);

    // Every compiled file must survive. Silently removing all of them while
    // printing success is how 12 files vanished across six folders.
    expect(exists(root, '.cursor/rules/testing.mdc')).toBe(true);
    expect(exists(root, '.claude/rules/testing.md')).toBe(true);
    expect(exists(root, '.clinerules/testing.md')).toBe(true);
    expect(process.exitCode).toBe(1);
  });

  it('leaves the AGENTS.md index alone when it refuses', async () => {
    const root = makeWorkspace();
    seedProject(root, { agents: ['cursor'], rules: { 'testing.md': MULTI_GLOB } });
    await syncAgents(root);

    require('fs').rmSync(require('path').join(root, '.codebuddy/rules/testing.md'));
    await syncAgents(root);

    expect(readFile(root, 'AGENTS.md')).toContain('.codebuddy/rules/testing.md');
  });

  it('still syncs normally when there are no rules AND no previous output', async () => {
    const root = makeWorkspace();
    seedProject(root, { agents: ['cursor'] });

    await syncAgents(root);

    // A genuinely empty project is not an error -- there is nothing to lose.
    expect(process.exitCode).not.toBe(1);
  });
});

describe('failure modes', () => {
  it('sets a non-zero exit code when there is no config', async () => {
    const root = makeWorkspace();

    await syncAgents(root);

    // Every error path used to return silently with exit code 0, so nothing
    // was detectable in CI -- and we recommend wiring sync into postinstall.
    // Fixed via core/report.ts's fail(), Task 3.5.
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
