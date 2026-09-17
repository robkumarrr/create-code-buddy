import { describe, it, expect, afterEach } from 'vitest';
import { updateAgentsMd } from './agents-md';
import { parseRule, type Rule } from './rule';
import { makeWorkspace, cleanupWorkspaces, readFile, writeFile, exists } from '../test/workspace';

/**
 * AGENTS.md is the one output this tool writes into a file users commonly
 * write themselves, so the safety property under test is the same one the
 * watermark gives the agent folders: everything outside the managed block
 * belongs to the author and is never touched.
 */

afterEach(() => cleanupWorkspaces());

function rule(relPath: string, description: string, globs: string[]): Rule {
  const globList = globs.map((g) => `"${g}"`).join(', ');
  return parseRule(relPath, `---\ndescription: ${description}\nglobs: [${globList}]\n---\n\n# Body`).rule;
}

const TESTING = rule('testing.md', 'Testing standards', ['*.test.ts']);
const ALWAYS = rule('architecture.md', 'Architecture', ['*.*']);

describe('updateAgentsMd', () => {
  it('creates AGENTS.md with an index when none exists', () => {
    const root = makeWorkspace();

    updateAgentsMd(root, [TESTING, ALWAYS], [], true);

    const content = readFile(root, 'AGENTS.md');
    expect(content).toContain('.codebuddy/rules/testing.md');
    expect(content).toContain('Testing standards');
    expect(content).toContain('applies to `*.test.ts`');
    expect(content).toContain('always applies');
  });

  it('indexes rules rather than inlining their bodies', () => {
    const root = makeWorkspace();

    updateAgentsMd(root, [TESTING, ALWAYS], [], true);

    // The whole point of a pointer: the rule text stays in .codebuddy/ and
    // doesn't ride along in context on every turn.
    expect(readFile(root, 'AGENTS.md')).not.toContain('# Body');
  });

  it('preserves hand-written content around the managed block', () => {
    const root = makeWorkspace();
    writeFile(root, 'AGENTS.md', '# My project\n\nRun `make dev` to start.\n');

    updateAgentsMd(root, [TESTING], [], true);

    const content = readFile(root, 'AGENTS.md');
    expect(content).toContain('# My project');
    expect(content).toContain('Run `make dev` to start.');
    expect(content).toContain('.codebuddy/rules/testing.md');
  });

  it('rewrites only the block on a second run, leaving surrounding text alone', () => {
    const root = makeWorkspace();
    writeFile(root, 'AGENTS.md', '# Mine\n\nAbove.\n');
    updateAgentsMd(root, [TESTING], [], true);
    writeFile(root, 'AGENTS.md', readFile(root, 'AGENTS.md') + '\n## Footer\n\nBelow.\n');

    updateAgentsMd(root, [ALWAYS], [], true);

    const content = readFile(root, 'AGENTS.md');
    expect(content).toContain('# Mine');
    expect(content).toContain('## Footer');
    expect(content).toContain('Below.');
    expect(content).toContain('.codebuddy/rules/architecture.md');
    // The previous run's entry is gone, not accumulated.
    expect(content).not.toContain('.codebuddy/rules/testing.md');
  });

  it('never writes the block twice', () => {
    const root = makeWorkspace();

    updateAgentsMd(root, [TESTING], [], true);
    updateAgentsMd(root, [TESTING], [], true);
    updateAgentsMd(root, [TESTING], [], true);

    const occurrences = readFile(root, 'AGENTS.md').split('create-code-buddy:start').length - 1;
    expect(occurrences).toBe(1);
  });

  it('removes the block when disabled but keeps the user\'s own file', () => {
    const root = makeWorkspace();
    writeFile(root, 'AGENTS.md', '# Mine\n\nKeep me.\n');
    updateAgentsMd(root, [TESTING], [], true);

    updateAgentsMd(root, [TESTING], [], false);

    const content = readFile(root, 'AGENTS.md');
    expect(content).toContain('Keep me.');
    expect(content).not.toContain('create-code-buddy:start');
    expect(content).not.toContain('.codebuddy/rules/testing.md');
  });

  it('deletes a file that only ever held our block', () => {
    const root = makeWorkspace();
    updateAgentsMd(root, [TESTING], [], true);

    updateAgentsMd(root, [TESTING], [], false);

    // Nothing of the user's was in it, so leaving an empty shell behind would
    // just be litter.
    expect(exists(root, 'AGENTS.md')).toBe(false);
  });

  it('does nothing when disabled and no file exists', () => {
    const root = makeWorkspace();

    updateAgentsMd(root, [TESTING], [], false);

    expect(exists(root, 'AGENTS.md')).toBe(false);
  });

  it('handles an empty rule set without producing a broken index', () => {
    const root = makeWorkspace();

    updateAgentsMd(root, [], [], true);

    expect(readFile(root, 'AGENTS.md')).toContain('No rules defined yet');
  });
});
