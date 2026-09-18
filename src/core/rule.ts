import YAML from 'yaml';

/**
 * The normalized, agent-agnostic representation of a single rule.
 *
 * Every adapter renders from this shape and nothing else. Parsing quirks —
 * the five different ways a human might write `globs`, a missing description,
 * frontmatter that isn't valid YAML — are all resolved here, once, so that no
 * adapter ever has to think about them.
 */
export interface Rule {
  /** Path relative to the SSOT dir, e.g. 'backend/database.md'. */
  relPath: string;
  description: string;
  /**
   * Always a normalized array, never a raw string and never undefined.
   * An empty array means the rule is not glob-targeted.
   */
  globs: string[];
  /** True when the rule should always be in context rather than glob-targeted. */
  alwaysApply: boolean;
  /**
   * True when the source file had a frontmatter block containing at least one
   * recognized key. False for a file with no `---` block at all, or an empty
   * one.
   *
   * This is distinct from `alwaysApply`: a rule can have explicit, non-empty
   * frontmatter that still resolves to always-apply (`globs: ["*.*"]`). It
   * exists for adapters — currently the Gemini/Windsurf legacy formatter,
   * see adapters/legacy-format.ts — that omit frontmatter entirely for a rule
   * whose source had none, rather than backfilling defaults the way Cursor
   * and Claude do.
   */
  hasFrontmatter: boolean;
  /**
   * Lifecycle of a spec — `planned`, `in progress`, `parked`, `done`, or
   * anything else the author writes. Shown beside the spec in the AGENTS.md
   * index so an agent can tell live work from shelved work. Empty for rules,
   * which have no lifecycle.
   */
  status: string;
  /**
   * Frontmatter keys this model does not interpret, preserved verbatim so
   * passthrough adapters can re-emit them.
   */
  extra: Record<string, unknown>;
  body: string;
}

export interface ParsedRule {
  rule: Rule;
  /**
   * Set when the frontmatter could not be parsed as YAML and a lenient
   * fallback was used. Callers should surface this; it must never abort a run.
   */
  warning?: string;
}

/** Glob patterns that mean "everything", and therefore imply alwaysApply. */
const UNIVERSAL_GLOBS = new Set(['*.*', '**/*', '**', '*']);

export const DEFAULT_DESCRIPTION = 'Code Buddy Rule';

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

/**
 * Splits on commas that are not nested inside brackets or braces, so that a
 * brace-expansion glob like `*.{ts,tsx}` survives intact.
 */
function splitTopLevel(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';

  for (const char of input) {
    if (char === '{' || char === '[' || char === '(') depth++;
    else if (char === '}' || char === ']' || char === ')') depth--;

    if (char === ',' && depth <= 0) {
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts;
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1).trim();
    }
  }
  return trimmed;
}

/**
 * Coerces any of the shapes a human or another tool might write into a clean
 * array of patterns:
 *
 *   globs: ["*.ts", "*.js"]      YAML flow array
 *   globs:                       YAML block list
 *     - "*.ts"
 *   globs: *.ts,*.js             bare comma-joined string
 *   globs: "*.ts", "*.js"        quoted comma-joined (invalid YAML, seen in the wild)
 *   globs: "*.ts"                single string
 */
export function normalizeGlobs(input: unknown): string[] {
  if (input === null || input === undefined) return [];

  if (Array.isArray(input)) {
    return input
      .map((entry) => unquote(String(entry)))
      .filter((entry) => entry.length > 0);
  }

  if (typeof input !== 'string') return [];

  let raw = input.trim();
  if (raw.length === 0) return [];

  // Strip a surrounding flow-array bracket before splitting.
  if (raw.startsWith('[') && raw.endsWith(']')) {
    raw = raw.slice(1, -1);
  }

  return splitTopLevel(raw)
    .map(unquote)
    .filter((entry) => entry.length > 0);
}

/**
 * Lenient line-based frontmatter parse, used only when YAML.parse fails.
 *
 * This exists because files already in the wild — including ones this tool
 * generated before the Copilot `applyTo` fix — contain frontmatter that is not
 * valid YAML. Refusing to read them would strand those users.
 */
function parseFrontmatterLenient(block: string): Record<string, unknown> {
  const attributes: Record<string, unknown> = {};
  for (const line of block.split('\n')) {
    const splitIndex = line.indexOf(':');
    if (splitIndex > 0) {
      const key = line.slice(0, splitIndex).trim();
      const value = line.slice(splitIndex + 1).trim();
      if (key) attributes[key] = value;
    }
  }
  return attributes;
}

function coerceBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lowered = value.trim().toLowerCase();
    if (lowered === 'true') return true;
    if (lowered === 'false') return false;
  }
  return undefined;
}

/**
 * Parses a raw rule file into the normalized model.
 *
 * Never throws. A file with broken frontmatter yields a usable rule plus a
 * warning, so that one bad file cannot take down a whole sync.
 */
export function parseRule(relPath: string, raw: string): ParsedRule {
  const match = raw.match(FRONTMATTER_RE);

  if (!match) {
    return {
      rule: {
        relPath,
        description: DEFAULT_DESCRIPTION,
        globs: [],
        alwaysApply: true,
        hasFrontmatter: false,
        status: '',
        extra: {},
        body: raw,
      },
    };
  }

  const [, frontmatterBlock, body] = match;

  let attributes: Record<string, unknown>;
  const warnings: string[] = [];

  try {
    const parsed = YAML.parse(frontmatterBlock);
    attributes =
      parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
  } catch (err) {
    attributes = parseFrontmatterLenient(frontmatterBlock);
    const reason = err instanceof Error ? err.message.split('\n')[0] : String(err);
    warnings.push(
      `${relPath}: frontmatter is not valid YAML (${reason}). Read it leniently — re-run sync after fixing it.`,
    );
  }

  const { description, globs, alwaysApply, status, ...extra } = attributes;

  const normalizedGlobs = normalizeGlobs(globs);
  const explicitAlwaysApply = coerceBoolean(alwaysApply);

  const impliedAlwaysApply =
    normalizedGlobs.length === 0 ||
    normalizedGlobs.every((glob) => UNIVERSAL_GLOBS.has(glob));

  // A rule with no globs cannot be glob-targeted — there is nothing to match
  // against. `alwaysApply: false` with no globs is contradictory, and taking
  // it literally compiles a rule that activates for nothing: an empty
  // `paths:` block, an empty `globs:`. Resolve it here rather than in each
  // adapter, and say so, because silently picking either reading for the
  // author is worse than telling them what they wrote.
  const contradictsEmptyGlobs = explicitAlwaysApply === false && normalizedGlobs.length === 0;
  if (contradictsEmptyGlobs) {
    warnings.push(
      `${relPath}: alwaysApply is false but the rule has no globs, so there is nothing to scope it to. ` +
        `Treating it as always-apply — add globs, or remove alwaysApply, to silence this.`,
    );
  }

  const rule: Rule = {
    relPath,
    description:
      typeof description === 'string' && description.trim().length > 0
        ? description.trim()
        : DEFAULT_DESCRIPTION,
    globs: normalizedGlobs,
    alwaysApply: contradictsEmptyGlobs ? true : (explicitAlwaysApply ?? impliedAlwaysApply),
    hasFrontmatter: Object.keys(attributes).length > 0,
    status: typeof status === 'string' ? status.trim() : '',
    extra,
    body,
  };

  // Joined rather than returned as a list so the public shape stays one
  // optional string, while a file with more than one problem still reports
  // all of them instead of only the first.
  return warnings.length > 0 ? { rule, warning: warnings.join(' ') } : { rule };
}

/**
 * Serializes frontmatter through a real YAML writer, delimiters included.
 *
 * Adapters must use this rather than string concatenation. Hand-built
 * frontmatter is what produced `applyTo: "*.ts", "*.js"` — output that no YAML
 * parser will accept. The deliberate exceptions are the bare comma-joined
 * `globs:` lines in `adapters/cursor.ts` and `adapters/windsurf.ts`, and the
 * legacy attribute lines in `adapters/legacy-format.ts`. None is YAML, and
 * each is covered by its own test.
 *
 * `singleQuote` matches the quoting style the wider ecosystem emits.
 */
export function renderFrontmatter(attributes: Record<string, unknown>): string {
  const entries = Object.entries(attributes).filter(
    ([, value]) => value !== undefined && value !== null,
  );
  if (entries.length === 0) return '';

  const body = YAML.stringify(Object.fromEntries(entries), { singleQuote: true });
  return `---\n${body}---\n`;
}

/** Joins globs the way Cursor and Copilot expect: comma-separated, no spaces. */
export function joinGlobs(globs: string[]): string {
  return globs.join(',');
}
