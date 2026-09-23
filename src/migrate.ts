import fs from 'fs';
import path from 'path';
import pc from 'picocolors';
import {
  SSOT_DIR,
  RULES_SUBDIR,
  SSOT_SUBDIRS,
  TOOL_NAME,
  LEGACY_SHORT_NAME,
  rulesRoot,
} from './core/constants';
import { getRuleFiles } from './core/fs';
import { fail } from './core/report';

/**
 * Moves a pre-`rules/` SSOT into the current layout.
 *
 * Rules used to sit directly in `.codebuddy/`; they now live in
 * `.codebuddy/rules/`. This exists so that upgrade is one explicit command
 * rather than something the tool does to a version-controlled source folder
 * behind the user's back. `sync` never calls it — it only points at it, via
 * the guard that refuses to garbage-collect when no rules are found.
 */

export interface PlannedMove {
  from: string;
  to: string;
}

/**
 * Files that need moving, as project-relative paths.
 *
 * Only loose files at the top of `.codebuddy/` and inside unrecognized
 * subdirectories count. Anything already under `rules/` or `specs/` is where
 * it belongs.
 */
export function planMigration(projectRoot: string): PlannedMove[] {
  const ssotDir = path.join(projectRoot, SSOT_DIR);
  if (!fs.existsSync(ssotDir)) return [];

  const moves: PlannedMove[] = [];
  for (const file of getRuleFiles(ssotDir)) {
    const [topSegment] = file.rel.split(path.sep);
    if ((SSOT_SUBDIRS as readonly string[]).includes(topSegment)) continue;

    moves.push({
      from: path.join(SSOT_DIR, file.rel),
      to: path.join(SSOT_DIR, RULES_SUBDIR, file.rel),
    });
  }
  return moves;
}

export interface PlannedRewrite {
  /** Project-relative path of the file to rewrite. */
  path: string;
  /** How many occurrences of the retired command it holds. */
  count: number;
}

/**
 * `npx ccb` exactly -- not `npx ccb-lint` or any other package that happens
 * to start with the same letters. A trailing `@version` is allowed through, so
 * `npx ccb@latest` becomes `npx create-code-buddy@latest`.
 */
const LEGACY_COMMAND = new RegExp(`npx ${LEGACY_SHORT_NAME}(?![\\w-])`, 'g');

/**
 * Files anywhere in the SSOT that still tell agents to run `npx ccb`.
 *
 * Scans the whole SSOT rather than only codebuddy-system.md: that is where the
 * template put it, but people copy working commands into their own rules.
 */
export function planRewrites(projectRoot: string): PlannedRewrite[] {
  const ssotDir = path.join(projectRoot, SSOT_DIR);
  if (!fs.existsSync(ssotDir)) return [];

  const rewrites: PlannedRewrite[] = [];
  for (const file of getRuleFiles(ssotDir)) {
    const matches = fs.readFileSync(file.abs, 'utf8').match(LEGACY_COMMAND);
    if (matches) {
      rewrites.push({ path: path.join(SSOT_DIR, file.rel), count: matches.length });
    }
  }
  return rewrites;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export async function migrate(projectRoot: string, apply: boolean = false): Promise<void> {
  const ssotDir = path.join(projectRoot, SSOT_DIR);
  if (!fs.existsSync(ssotDir)) {
    fail(`No ${SSOT_DIR} directory found. Run \`npx ${TOOL_NAME} init\` first.`);
    return;
  }

  const moves = planMigration(projectRoot);
  const rewrites = planRewrites(projectRoot);

  if (moves.length === 0 && rewrites.length === 0) {
    console.log(pc.green(`✔ Already up to date — nothing to migrate.`));
    return;
  }

  if (moves.length > 0) {
    console.log(pc.cyan(`\n  Rules now live in ${SSOT_DIR}/${RULES_SUBDIR}/. Moving ${plural(moves.length, 'file')}:\n`));
    for (const move of moves) {
      console.log(`  ${pc.dim(move.from)} → ${pc.cyan(move.to)}`);
    }
  }

  if (rewrites.length > 0) {
    console.log(
      pc.cyan(`\n  \`npx ${LEGACY_SHORT_NAME}\` runs an unrelated npm package. Rewriting to \`npx ${TOOL_NAME}\`:\n`),
    );
    for (const rewrite of rewrites) {
      console.log(`  ${pc.dim(rewrite.path)} ${pc.dim(`(${plural(rewrite.count, 'occurrence')})`)}`);
    }
  }

  if (!apply) {
    console.log(pc.yellow(`\n  Nothing changed. Re-run with --apply to make these changes.\n`));
    return;
  }

  // Refuse rather than overwrite: a file already at the destination means the
  // user has both layouts, and picking a winner for them silently is worse
  // than stopping.
  const collisions = moves.filter((move) => fs.existsSync(path.join(projectRoot, move.to)));
  if (collisions.length > 0) {
    fail(
      `Cannot migrate — these already exist at the destination:\n` +
        collisions.map((move) => `  ${move.to}`).join('\n') +
        `\n  Resolve them by hand, then re-run.`,
    );
    return;
  }

  if (moves.length > 0) {
    fs.mkdirSync(rulesRoot(projectRoot), { recursive: true });
    for (const move of moves) {
      const to = path.join(projectRoot, move.to);
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.renameSync(path.join(projectRoot, move.from), to);
    }
  }

  // Re-planned after the moves, so a file that just moved is rewritten at its
  // new path rather than its old one.
  let rewritten = 0;
  for (const rewrite of planRewrites(projectRoot)) {
    const target = path.join(projectRoot, rewrite.path);
    const content = fs.readFileSync(target, 'utf8');
    fs.writeFileSync(target, content.replace(LEGACY_COMMAND, `npx ${TOOL_NAME}`));
    rewritten++;
  }

  const done = [
    moves.length > 0 ? `moved ${plural(moves.length, 'file')}` : '',
    rewritten > 0 ? `rewrote ${plural(rewritten, 'file')}` : '',
  ].filter(Boolean).join(', ');

  console.log(
    pc.green(`\n✔ ${done.charAt(0).toUpperCase()}${done.slice(1)}.`) +
      pc.dim(` Run \`npx ${TOOL_NAME} sync\` to recompile.\n`),
  );
}
