import { describe, it, expect } from 'vitest';
import YAML from 'yaml';
import {
  parseRule,
  normalizeGlobs,
  renderFrontmatter,
  joinGlobs,
  DEFAULT_DESCRIPTION,
} from './rule';

describe('normalizeGlobs', () => {
  it('accepts a YAML flow array', () => {
    expect(normalizeGlobs(['*.ts', '*.js'])).toEqual(['*.ts', '*.js']);
  });

  it('accepts a bracketed string that never reached a YAML parser', () => {
    expect(normalizeGlobs('["*.ts", "*.js"]')).toEqual(['*.ts', '*.js']);
  });

  it('accepts a bare comma-joined string', () => {
    expect(normalizeGlobs('*.ts,*.js')).toEqual(['*.ts', '*.js']);
  });

  it('accepts a comma-joined string with spaces', () => {
    expect(normalizeGlobs('*.ts, *.js , *.tsx')).toEqual(['*.ts', '*.js', '*.tsx']);
  });

  it('accepts a quoted comma-joined string (the invalid-YAML form seen in the wild)', () => {
    expect(normalizeGlobs('"*.ts", "*.js"')).toEqual(['*.ts', '*.js']);
  });

  it('accepts a single string', () => {
    expect(normalizeGlobs('*.ts')).toEqual(['*.ts']);
  });

  it('strips single quotes as well as double', () => {
    expect(normalizeGlobs("'*.ts', '*.js'")).toEqual(['*.ts', '*.js']);
  });

  it('preserves commas inside brace expansion', () => {
    expect(normalizeGlobs('*.{ts,tsx}')).toEqual(['*.{ts,tsx}']);
    expect(normalizeGlobs('*.{ts,tsx},*.css')).toEqual(['*.{ts,tsx}', '*.css']);
  });

  it('returns an empty array for absent, empty or non-glob input', () => {
    expect(normalizeGlobs(undefined)).toEqual([]);
    expect(normalizeGlobs(null)).toEqual([]);
    expect(normalizeGlobs('')).toEqual([]);
    expect(normalizeGlobs('   ')).toEqual([]);
    expect(normalizeGlobs([])).toEqual([]);
    expect(normalizeGlobs(42)).toEqual([]);
  });

  it('drops empty entries from trailing or doubled commas', () => {
    expect(normalizeGlobs('*.ts,,*.js,')).toEqual(['*.ts', '*.js']);
  });
});

describe('parseRule', () => {
  it('parses a standard flow-array rule', () => {
    const { rule, warning } = parseRule(
      'testing.md',
      '---\ndescription: Testing standards\nglobs: ["*.test.ts", "*.spec.ts"]\n---\n\n# Testing\n\nUse vitest.',
    );

    expect(warning).toBeUndefined();
    expect(rule.relPath).toBe('testing.md');
    expect(rule.description).toBe('Testing standards');
    expect(rule.globs).toEqual(['*.test.ts', '*.spec.ts']);
    expect(rule.alwaysApply).toBe(false);
    expect(rule.body.trim()).toBe('# Testing\n\nUse vitest.');
  });

  /**
   * The regression that motivated replacing the line-splitting parser: a block
   * list is the form a human most naturally hand-writes, and the old parser read
   * `globs` as an empty string, silently turning a targeted rule into one applied
   * to every file in the repo.
   */
  it('parses a YAML block list without flattening it to always-on', () => {
    const { rule } = parseRule(
      'multiline.md',
      '---\ndescription: Hand written\nglobs:\n  - "*.ts"\n  - "*.tsx"\n---\n\n# Body',
    );

    expect(rule.globs).toEqual(['*.ts', '*.tsx']);
    expect(rule.alwaysApply).toBe(false);
  });

  it('parses a bare comma-joined globs line', () => {
    const { rule } = parseRule(
      'cursorish.md',
      '---\ndescription: Imported\nglobs: *.ts,*.js\n---\n\n# Body',
    );
    expect(rule.globs).toEqual(['*.ts', '*.js']);
  });

  it('preserves an explicit alwaysApply over what the globs imply', () => {
    const { rule } = parseRule(
      'always.md',
      '---\ndescription: Always\nglobs: ["*.ts"]\nalwaysApply: true\n---\n\n# Body',
    );
    expect(rule.alwaysApply).toBe(true);
    expect(rule.globs).toEqual(['*.ts']);
  });

  it('honours an explicit alwaysApply: false even for a universal glob', () => {
    const { rule } = parseRule(
      'manual.md',
      '---\ndescription: Manual\nglobs: ["*.*"]\nalwaysApply: false\n---\n\n# Body',
    );
    expect(rule.alwaysApply).toBe(false);
  });

  it.each(['*.*', '**/*', '**', '*'])('treats %s as always-on', (glob) => {
    const { rule } = parseRule(
      'universal.md',
      `---\ndescription: Everything\nglobs: ["${glob}"]\n---\n\n# Body`,
    );
    expect(rule.alwaysApply).toBe(true);
  });

  it('treats a rule with no globs as always-on', () => {
    const { rule } = parseRule('bare.md', '---\ndescription: Bare\n---\n\n# Body');
    expect(rule.globs).toEqual([]);
    expect(rule.alwaysApply).toBe(true);
  });

  it('defaults the description when absent or blank', () => {
    expect(parseRule('a.md', '---\nglobs: ["*.ts"]\n---\n\n# Body').rule.description).toBe(
      DEFAULT_DESCRIPTION,
    );
    expect(
      parseRule('b.md', '---\ndescription: "   "\nglobs: ["*.ts"]\n---\n\n# Body').rule
        .description,
    ).toBe(DEFAULT_DESCRIPTION);
  });

  it('preserves unmodelled frontmatter keys in extra', () => {
    const { rule } = parseRule(
      'extra.md',
      '---\ndescription: Test\nglobs: ["*.ts"]\ntrigger: glob\npriority: 3\n---\n\n# Body',
    );
    expect(rule.extra).toEqual({ trigger: 'glob', priority: 3 });
    expect(rule.extra).not.toHaveProperty('description');
    expect(rule.extra).not.toHaveProperty('globs');
  });

  it('handles a file with no frontmatter at all', () => {
    const { rule, warning } = parseRule('plain.md', '# Just a heading\n\nNo frontmatter.');
    expect(warning).toBeUndefined();
    expect(rule.description).toBe(DEFAULT_DESCRIPTION);
    expect(rule.globs).toEqual([]);
    expect(rule.alwaysApply).toBe(true);
    expect(rule.body).toBe('# Just a heading\n\nNo frontmatter.');
  });

  it('does not treat a horizontal rule in the body as frontmatter', () => {
    const { rule } = parseRule(
      'hr.md',
      '---\ndescription: Test\nglobs: ["*.ts"]\n---\n\n# Body\n\nabove\n\n---\n\nbelow',
    );
    expect(rule.description).toBe('Test');
    expect(rule.body).toContain('above');
    expect(rule.body).toContain('---');
    expect(rule.body).toContain('below');
  });

  it('parses CRLF files', () => {
    const { rule } = parseRule(
      'crlf.md',
      '---\r\ndescription: Windows\r\nglobs: ["*.ts"]\r\n---\r\n\r\n# Body',
    );
    expect(rule.description).toBe('Windows');
    expect(rule.globs).toEqual(['*.ts']);
  });

  /**
   * Files generated by this tool before the Copilot fix contain exactly this
   * shape. Refusing to read them would strand existing users, so a broken file
   * degrades to a lenient read plus a warning rather than an exception.
   */
  it('falls back leniently and warns on frontmatter that is not valid YAML', () => {
    const { rule, warning } = parseRule(
      'broken.md',
      '---\napplyTo: "*.ts", "*.js"\n---\n\n# Body',
    );

    expect(warning).toBeDefined();
    expect(warning).toContain('broken.md');
    expect(rule.body.trim()).toBe('# Body');
    expect(rule.extra.applyTo).toBe('"*.ts", "*.js"');
  });

  it('never throws on malformed input', () => {
    const inputs = ['', '---\n---\n', '---\n\t bad: [\n---\nbody', '---\nnot a mapping\n---\nbody'];
    for (const input of inputs) {
      expect(() => parseRule('x.md', input)).not.toThrow();
    }
  });
});

describe('parseRule: hasFrontmatter', () => {
  it('is false for a file with no frontmatter block at all', () => {
    expect(parseRule('plain.md', '# Just a heading').rule.hasFrontmatter).toBe(false);
  });

  it('is true when at least one recognized key is present', () => {
    expect(
      parseRule('a.md', '---\ndescription: X\n---\n\nBody').rule.hasFrontmatter,
    ).toBe(true);
    expect(
      parseRule('b.md', '---\nglobs: ["*.ts"]\n---\n\nBody').rule.hasFrontmatter,
    ).toBe(true);
  });

  it('is true for a universal-glob rule, distinct from alwaysApply', () => {
    // A rule can have explicit, non-empty frontmatter that still resolves to
    // always-apply -- the two facts are independent.
    const { rule } = parseRule('u.md', '---\ndescription: X\nglobs: ["*.*"]\n---\n\nBody');
    expect(rule.hasFrontmatter).toBe(true);
    expect(rule.alwaysApply).toBe(true);
  });

  it('is false for an empty frontmatter block', () => {
    expect(parseRule('empty.md', '---\n---\n\nBody').rule.hasFrontmatter).toBe(false);
  });
});

describe('renderFrontmatter', () => {
  it('produces parseable YAML for values that need quoting', () => {
    const rendered = renderFrontmatter({
      description: 'Testing standards',
      applyTo: '*.test.ts,*.spec.ts',
    });

    const inner = rendered.replace(/^---\n/, '').replace(/---\n$/, '');
    expect(YAML.parse(inner)).toEqual({
      description: 'Testing standards',
      applyTo: '*.test.ts,*.spec.ts',
    });
  });

  it('single-quotes strings, matching ecosystem convention', () => {
    expect(renderFrontmatter({ applyTo: '*.ts,*.js' })).toBe(
      "---\napplyTo: '*.ts,*.js'\n---\n",
    );
  });

  it('writes arrays as a block list', () => {
    expect(renderFrontmatter({ paths: ['*.test.ts', '*.spec.ts'] })).toBe(
      "---\npaths:\n  - '*.test.ts'\n  - '*.spec.ts'\n---\n",
    );
  });

  it('omits undefined and null values', () => {
    expect(renderFrontmatter({ description: 'x', globs: undefined, extra: null })).toBe(
      '---\ndescription: x\n---\n',
    );
  });

  it('returns an empty string when there is nothing to write', () => {
    expect(renderFrontmatter({})).toBe('');
    expect(renderFrontmatter({ a: undefined })).toBe('');
  });
});

describe('joinGlobs', () => {
  it('joins with commas and no spaces', () => {
    expect(joinGlobs(['*.ts', '*.js'])).toBe('*.ts,*.js');
  });

  it('returns an empty string for no globs', () => {
    expect(joinGlobs([])).toBe('');
  });
});
