import fs from 'fs';
import path from 'path';
import pc from 'picocolors';
import {
  SSOT_DIR,
  CONFIG_FILE,
  TOOL_NAME,
  WATERMARK,
  GITIGNORE_START,
  GITIGNORE_END,
  AGENTS_MD_FILE,
  RULES_SUBDIR,
  SSOT_SUBDIRS,
  rulesRoot,
  specsRoot,
} from './core/constants';
import { getRuleFiles, writeFileDeep, pruneEmptyDirs } from './core/fs';
import { parseRule, type Rule } from './core/rule';
import { fail } from './core/report';
import { updateAgentsMd } from './core/agents-md';
import { planMigration } from './migrate';
import { ADAPTERS } from './adapters';

export interface CodeBuddyConfig {
  agents: string[];
  gitignore_compiled_agents: boolean;
  /** Absent in configs written before AGENTS.md support; treated as true. */
  agents_md?: boolean;
  /**
   * What `agents_md` was called in the earlier pointer-block release. Read so
   * an existing config keeps the setting its owner chose; never written.
   */
  update_agents_md?: boolean;
}

export function getConfig(projectRoot: string): CodeBuddyConfig | null {
  const configPath = path.join(projectRoot, SSOT_DIR, CONFIG_FILE);
  if (!fs.existsSync(configPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    return null;
  }
}

export function updateGitignore(projectRoot: string, foldersToIgnore: string[], remove: boolean = false) {
  const gitignorePath = path.join(projectRoot, '.gitignore');

  let content = '';
  if (fs.existsSync(gitignorePath)) {
    content = fs.readFileSync(gitignorePath, 'utf8');
  }

  let startIndex = content.indexOf(GITIGNORE_START);
  while (startIndex !== -1) {
    const endIndex = content.indexOf(GITIGNORE_END, startIndex);
    if (endIndex !== -1) {
      // Find the start of the line with the START_MARKER
      const lineStart = content.lastIndexOf('\n', startIndex) === -1 ? 0 : content.lastIndexOf('\n', startIndex);
      const after = content.substring(endIndex + GITIGNORE_END.length);
      content = content.substring(0, lineStart) + after;
    } else {
      break;
    }
    startIndex = content.indexOf(GITIGNORE_START);
  }

  if (!remove && foldersToIgnore.length > 0) {
    const block = `\n${GITIGNORE_START}\n${foldersToIgnore.join('\n')}\n${GITIGNORE_END}\n`;
    content = content.trim() + '\n' + block;
  }

  content = content.trim() + '\n';

  // Only write if there's actual content or if we had a file before
  if (content.trim() || fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, content);
  }
}

/**
 * Deletes any watermarked file under `targetBase` that isn't in
 * `expectedRelativePaths`. A hand-written file with no watermark is never
 * touched, no matter what — that guarantee is the reason `clean` and this
 * garbage collector can share a folder with a user's own rules.
 *
 * A deletion that empties a directory prunes it too. Only directories this
 * tool emptied itself, never ones the user happens to have left bare.
 */
function cleanStaleRules(targetBase: string, expectedRelativePaths: Set<string>): number {
  if (!fs.existsSync(targetBase)) return 0;

  let removed = 0;
  for (const file of getRuleFiles(targetBase)) {
    const content = fs.readFileSync(file.abs, 'utf8');
    if (content.includes(WATERMARK) && !expectedRelativePaths.has(file.rel)) {
      fs.unlinkSync(file.abs);
      // Tidy up the directory too, or de-compiling a nested rule leaves an
      // empty folder behind in every agent tree for someone to wonder about.
      pruneEmptyDirs(path.dirname(file.abs), targetBase);
      removed++;
    }
  }
  return removed;
}

/**
 * True when any adapter folder still holds a file this tool generated.
 *
 * Used as a tripwire: zero source rules plus existing generated output is far
 * more likely to be a mistake — an accidental delete, or an upgrade looking in
 * a directory the rules haven't moved to yet — than a deliberate request to
 * remove everything. Without this, that combination silently deletes every
 * compiled file across all six folders while reporting success.
 */
function hasGeneratedOutput(projectRoot: string): boolean {
  for (const adapter of ADAPTERS) {
    const base = path.join(projectRoot, adapter.rulesDir);
    if (!fs.existsSync(base)) continue;
    for (const file of getRuleFiles(base)) {
      if (fs.readFileSync(file.abs, 'utf8').includes(WATERMARK)) return true;
    }
  }
  return false;
}

/**
 * The same collection pass for directories an adapter writes into outside its
 * `rulesDir` (see `AgentAdapter.extraDirs`). Expected paths are project-
 * relative here, because that is how `extraFiles` names what it produces.
 */
function cleanStaleExtras(projectRoot: string, dir: string, expectedFromRoot: Set<string>) {
  const base = path.join(projectRoot, dir);
  if (!fs.existsSync(base)) return;

  for (const file of getRuleFiles(base)) {
    const content = fs.readFileSync(file.abs, 'utf8');
    if (!content.includes(WATERMARK)) continue;
    if (expectedFromRoot.has(path.relative(projectRoot, file.abs))) continue;
    fs.unlinkSync(file.abs);
  }
}

/** Parses every rule file under one SSOT subdirectory, surfacing warnings. */
function readSsotDir(dir: string): Rule[] {
  const rules: Rule[] = [];
  for (const file of getRuleFiles(dir)) {
    const { rule, warning } = parseRule(file.rel, fs.readFileSync(file.abs, 'utf8'));
    if (warning) console.log(pc.yellow(`⚠ ${warning}`));
    rules.push(rule);
  }
  return rules;
}

/**
 * Says something when the SSOT holds a directory this tool doesn't recognize.
 *
 * A folder name is a promise about where its contents compile to, and only
 * `rules/` and `specs/` have one. Silently ignoring anything else would leave
 * someone wondering why their files never appear in any agent folder.
 */
function warnAboutUnknownSubdirs(projectRoot: string): void {
  const ssotDir = path.join(projectRoot, SSOT_DIR);
  if (!fs.existsSync(ssotDir)) return;

  for (const entry of fs.readdirSync(ssotDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if ((SSOT_SUBDIRS as readonly string[]).includes(entry.name)) continue;
    console.log(
      pc.yellow(
        `⚠ Ignoring ${SSOT_DIR}/${entry.name}/ — not a recognized folder. ` +
          `Rules belong in ${SSOT_DIR}/${RULES_SUBDIR}/.`,
      ),
    );
  }
}

export async function syncAgents(projectRoot: string) {
  const config = getConfig(projectRoot);
  if (!config) {
    fail(`No ${SSOT_DIR}/${CONFIG_FILE} found. Run \`npx ${TOOL_NAME} init\` first.`);
    return;
  }

  const rules = readSsotDir(rulesRoot(projectRoot));
  const specs = readSsotDir(specsRoot(projectRoot));
  warnAboutUnknownSubdirs(projectRoot);

  if (rules.length === 0 && hasGeneratedOutput(projectRoot)) {
    // Distinguish the two ways to land here, because the fix differs: an older
    // layout needs migrating, an empty rules folder needs the files back.
    const pendingMoves = planMigration(projectRoot);
    const remedy =
      pendingMoves.length > 0
        ? `  Your rules are still in the older layout. Run \`npx ${TOOL_NAME} migrate\` to move\n` +
          `  them into ${SSOT_DIR}/${RULES_SUBDIR}/, then sync again.`
        : `  Restore the rules, or run \`npx ${TOOL_NAME} clean\` if you really do want the\n` +
          `  generated files gone.`;

    fail(
      `No rules found in ${SSOT_DIR}/${RULES_SUBDIR}/, but generated files still exist in your\n` +
        `  agent folders. Refusing to delete them.\n` +
        remedy,
    );
    return;
  }

  const ignorePathsByAgent = new Map<string, string[]>();

  for (const adapter of ADAPTERS) {
    const active = config.agents.includes(adapter.id);
    const targetBase = path.join(projectRoot, adapter.rulesDir);

    // Iterate every adapter, active or not, with an empty expected-set when
    // inactive: cleanStaleRules then treats every one of its own previously
    // compiled files as an orphan and removes them. This is what makes
    // deselecting an agent in `init` actually remove its folder, and it is
    // self-healing even if config.json is hand-edited — no extra state needed.
    const expectedPaths = active ? new Set(rules.map((rule) => adapter.outputPath(rule))) : new Set<string>();
    const removed = cleanStaleRules(targetBase, expectedPaths);

    // Same treatment for anything the adapter writes outside its rulesDir:
    // when inactive the expected set is empty, so all of it collects.
    const extraFiles = active ? (adapter.extraFiles?.(rules) ?? []) : [];
    const expectedExtras = new Set(extraFiles.map((extra) => path.normalize(extra.path)));
    for (const dir of adapter.extraDirs ?? []) {
      cleanStaleExtras(projectRoot, dir, expectedExtras);
    }

    // Runs regardless of active/inactive, like the collectors above -- an
    // orphan left in a now-abandoned output location is still an orphan
    // whether or not the agent that made it is currently selected.
    adapter.collectLegacyOrphans?.(projectRoot);

    if (!active) continue;

    for (const rule of rules) {
      const targetAbs = path.join(targetBase, adapter.outputPath(rule));
      writeFileDeep(targetAbs, adapter.render(rule));
    }

    for (const extra of extraFiles) {
      writeFileDeep(path.join(projectRoot, extra.path), extra.content);
    }

    ignorePathsByAgent.set(adapter.id, adapter.ignorePaths);

    // Say what actually happened, including deletions. A bare tick used to
    // print even when the run had removed every file it found.
    const wrote = `${rules.length} rule${rules.length === 1 ? '' : 's'}`;
    const alsoRemoved = removed > 0 ? pc.dim(` (removed ${removed} stale)`) : '';
    console.log(
      pc.green(`✔ Compiled ${wrote} → ${adapter.label}`) +
        pc.dim(` (${adapter.rulesDir})`) +
        alsoRemoved,
    );
  }

  // Reassemble the ignore list in config.agents's own order rather than the
  // registry's fixed iteration order. The old per-agent if/else blocks were
  // driven directly by config.agents, so a folder's position in .gitignore
  // tracked the order agents were selected in. That has no functional
  // meaning (gitignore patterns match independent of line order) but
  // reproducing it exactly — for any agent order, not just the common one —
  // costs nothing and keeps this a genuine refactor rather than a new
  // canonical ordering nobody asked for.
  const foldersToIgnore = config.agents.flatMap((id) => ignorePathsByAgent.get(id) ?? []);

  updateGitignore(projectRoot, foldersToIgnore, !config.gitignore_compiled_agents);

  // Defaults on for configs written before this existed: the pointer is
  // additive and non-destructive, and it is the only thing reaching agents
  // with no adapter of their own.
  const agentsMdEnabled = (config.agents_md ?? config.update_agents_md) !== false;
  updateAgentsMd(projectRoot, rules, specs, agentsMdEnabled);
  if (agentsMdEnabled) {
    console.log(pc.green(`✔ Indexed rules in ${AGENTS_MD_FILE}`));
  }
}
