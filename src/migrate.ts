import fs from 'fs';
import path from 'path';
import pc from 'picocolors';
import { SSOT_DIR, RULES_SUBDIR, SSOT_SUBDIRS, TOOL_NAME, rulesRoot } from './core/constants';
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

export async function migrate(projectRoot: string, apply: boolean = false): Promise<void> {
  const ssotDir = path.join(projectRoot, SSOT_DIR);
  if (!fs.existsSync(ssotDir)) {
    fail(`No ${SSOT_DIR} directory found. Run \`npx ${TOOL_NAME} init\` first.`);
    return;
  }

  const moves = planMigration(projectRoot);

  if (moves.length === 0) {
    console.log(pc.green(`✔ Already using the current layout — nothing to migrate.`));
    return;
  }

  console.log(pc.cyan(`\n  Rules now live in ${SSOT_DIR}/${RULES_SUBDIR}/. Moving ${moves.length} file${moves.length === 1 ? '' : 's'}:\n`));
  for (const move of moves) {
    console.log(`  ${pc.dim(move.from)} → ${pc.cyan(move.to)}`);
  }

  if (!apply) {
    console.log(pc.yellow(`\n  Nothing changed. Re-run with --apply to move them.\n`));
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

  fs.mkdirSync(rulesRoot(projectRoot), { recursive: true });
  for (const move of moves) {
    const to = path.join(projectRoot, move.to);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.renameSync(path.join(projectRoot, move.from), to);
  }

  console.log(
    pc.green(`\n✔ Moved ${moves.length} file${moves.length === 1 ? '' : 's'}.`) +
      pc.dim(` Run \`npx ${TOOL_NAME} sync\` to recompile.\n`),
  );
}
