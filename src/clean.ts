import fs from 'fs';
import path from 'path';
import pc from 'picocolors';
import { confirm, multiselect, isCancel } from '@clack/prompts';
import { updateGitignore } from './sync';
import { WATERMARK, SSOT_DIR, POSTINSTALL_SCRIPT } from './core/constants';
import { getRuleFiles, pruneEmptyDirs } from './core/fs';
import { ADAPTERS } from './adapters';
import { updateAgentsMd } from './core/agents-md';

/**
 * Colors used only for this folder-selection prompt, keyed by adapter id.
 * Deliberately not part of `AgentAdapter` itself (see adapters/types.ts) —
 * `label` there is plain text for prompts in general, and how one specific
 * prompt decorates it is this file's concern, not the adapter's.
 */
const AGENT_COLORS: Record<string, (s: string) => string> = {
  claude: pc.yellow,
  cline: pc.blue,
  cursor: pc.cyan,
  gemini: pc.magenta,
  copilot: pc.green,
  windsurf: pc.blue,
};

/**
 * The folders this tool can clean, derived from the same registry `sync.ts`
 * compiles from. Previously a hand-maintained array here, kept separately
 * from sync.ts's own per-agent list — the two had already drifted from each
 * other once (Gemini's folder moved without this list following).
 */
const AGENT_FOLDERS = ADAPTERS.flatMap((adapter) => {
  const color = AGENT_COLORS[adapter.id] ?? pc.dim;
  const row = (dir: string) => ({
    value: dir,
    label: `${adapter.label.padEnd(15)} ${pc.dim(color(`(${dir})`))}`,
  });

  // extraDirs are part of the adapter's footprint too — a factory reset that
  // skipped them would leave generated files behind and still call itself a
  // reset.
  return [row(adapter.rulesDir), ...(adapter.extraDirs ?? []).map(row)];
});

export async function cleanAgents(projectRoot: string, isHard: boolean = false, force: boolean = false) {
  if (isHard) {
    // ── HARD RESET ──────────────────────────────────────────────
    const codebuddyDir = path.join(projectRoot, SSOT_DIR);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupName = `.codebuddy-backup-${timestamp}.tar.gz`;

    console.log(pc.yellow('\n  ⚠️  WARNING: Factory Reset\n'));
    console.log(pc.white('  This will permanently delete:'));
    console.log(pc.dim('    • All compiled agent folders (.cursor/rules, .agents, .clinerules, etc.)'));
    console.log(pc.dim('    • Your .codebuddy/ source folder and ALL rules inside it'));
    console.log(pc.dim('    • The postinstall script from package.json'));
    if (fs.existsSync(codebuddyDir)) {
      console.log(pc.dim(`\n  A backup will be created first at: `) + pc.cyan(backupName));
    }
    console.log('');

    if (!force) {
      const firstConfirm = await confirm({ message: 'Are you absolutely sure you want to factory reset everything?' });
      if (isCancel(firstConfirm) || !firstConfirm) {
        console.log(pc.yellow('Factory reset cancelled.'));
        return;
      }

      const secondConfirm = await confirm({ message: pc.red('Last chance — this cannot be undone. Proceed?') });
      if (isCancel(secondConfirm) || !secondConfirm) {
        console.log(pc.yellow('Factory reset cancelled.'));
        return;
      }
    }

    // Create tar.gz backup before nuking
    let backupCreated = false;
    if (fs.existsSync(codebuddyDir)) {
      try {
        const { execSync } = await import('child_process');
        const backupPath = path.join(projectRoot, backupName);
        execSync(`tar -czf "${backupPath}" -C "${projectRoot}" ${SSOT_DIR}`);
        console.log(pc.green(`\n  ✔ Backup created: `) + pc.cyan(backupName));
        backupCreated = true;
      } catch {
        console.log(pc.yellow('  Warning: Could not create backup. Proceeding anyway.'));
      }
    }

    // Nuke all compiled folders + .codebuddy
    const allFolders = [...AGENT_FOLDERS.map((f) => f.value), SSOT_DIR];
    let deletedCount = 0;
    for (const folder of allFolders) {
      const dirPath = path.join(projectRoot, folder);
      if (fs.existsSync(dirPath)) {
        try {
          fs.rmSync(dirPath, { recursive: true, force: true });
          console.log(pc.dim(`  Deleted ${folder}`));
          deletedCount++;
        } catch {
          console.log(pc.yellow(`  Warning: Could not delete ${folder}. It may be locked by another process.`));
        }
      }
    }

    // Strip the compiled-folder entries first -- everything they pointed at
    // was just deleted -- then, separately, add the backup's own entry. Doing
    // both through one `remove: true` call was the first of two bugs here:
    // `updateGitignore` with `remove: true` never writes a new block
    // regardless of what's passed for foldersToIgnore, so the backup entry
    // added earlier was stripped straight back out a few lines later.
    updateGitignore(projectRoot, [], true);
    if (backupCreated) {
      // The second bug: `*.codebuddy-backup.tar.gz` requires the filename to
      // literally END with ".codebuddy-backup.tar.gz" -- it never matched
      // ".codebuddy-backup-<timestamp>.tar.gz", timestamp or no.
      updateGitignore(projectRoot, ['.codebuddy-backup-*.tar.gz'], false);
    }
    console.log(pc.dim('  Cleaned .gitignore entries'));

    // The pointer would otherwise survive the thing it points at, telling
    // agents to read a .codebuddy/ that no longer exists.
    updateAgentsMd(projectRoot, [], false);

    const pkgPath = path.join(projectRoot, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg.scripts?.postinstall === POSTINSTALL_SCRIPT) {
          delete pkg.scripts.postinstall;
          if (Object.keys(pkg.scripts).length === 0) delete pkg.scripts;
          fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
          console.log(pc.dim('  Cleaned postinstall script from package.json'));
        }
      } catch {
        console.log(pc.yellow('  Warning: Could not parse package.json to remove postinstall.'));
      }
    }

    console.log(pc.green(`\n✔ Factory reset complete. ${deletedCount} folders deleted.\n`));
    return;
  }

  // ── SMART CLEAN ─────────────────────────────────────────────
  const existingFolders = AGENT_FOLDERS.filter((f) => fs.existsSync(path.join(projectRoot, f.value)));

  if (existingFolders.length === 0) {
    console.log(pc.yellow('\n  No compiled agent folders found to clean.\n'));
    return;
  }

  const selectedFolders = await multiselect({
    message: 'Select the agent folders where you want to delete Code Buddy\'s generated rules:',
    options: existingFolders,
    initialValues: existingFolders.map((f) => f.value),
    required: false,
  });

  if (isCancel(selectedFolders) || (selectedFolders as string[]).length === 0) {
    console.log(pc.yellow('Clean cancelled.'));
    return;
  }

  // Build preview — scan each folder for watermarked vs personal files
  const targets = selectedFolders as string[];
  const preview: { folder: string; toDelete: string[]; toSkip: number }[] = [];

  for (const folder of targets) {
    const dirPath = path.join(projectRoot, folder);
    const files = getRuleFiles(dirPath);
    const toDelete: string[] = [];
    let toSkip = 0;
    for (const file of files) {
      const content = fs.readFileSync(file.abs, 'utf8');
      if (content.includes(WATERMARK)) {
        toDelete.push(file.abs);
      } else {
        toSkip++;
      }
    }
    if (toDelete.length > 0 || toSkip > 0) {
      preview.push({ folder, toDelete, toSkip });
    }
  }

  // Print the preview summary
  console.log('');
  console.log(pc.white('  Here\'s what will happen:\n'));
  if (preview.length === 0) {
    console.log(pc.dim('  Nothing to delete — no generated files found in the selected folders.'));
    return;
  }
  for (const p of preview) {
    const deleteMsg = p.toDelete.length > 0
      ? pc.red(`${p.toDelete.length} generated file${p.toDelete.length > 1 ? 's' : ''} will be deleted`)
      : pc.dim('nothing to delete');
    const skipMsg = p.toSkip > 0
      ? pc.green(`, ${p.toSkip} personal file${p.toSkip > 1 ? 's' : ''} will be skipped`)
      : '';
    console.log(`  ${pc.cyan(p.folder.padEnd(28))}${deleteMsg}${skipMsg}`);
  }
  console.log(pc.dim('\n  Your personal rules (no watermark) will never be touched.\n'));

  const totalToDelete = preview.reduce((acc, p) => acc + p.toDelete.length, 0);
  if (totalToDelete === 0) {
    console.log(pc.dim('  Nothing generated to delete — any personal rules shown above are safe.\n'));
    return;
  }

  const shouldClean = await confirm({ message: 'Delete these generated files?' });
  if (isCancel(shouldClean) || !shouldClean) {
    console.log(pc.yellow('Clean cancelled.'));
    return;
  }

  // Execute deletions — watermarked files only
  let deletedCount = 0;
  for (const p of preview) {
    for (const file of p.toDelete) {
      try {
        fs.unlinkSync(file);
        deletedCount++;
        pruneEmptyDirs(path.dirname(file), path.join(projectRoot, p.folder));
      } catch {
        console.log(pc.yellow(`  Warning: Could not delete ${file}. It may be locked.`));
      }
    }
  }

  updateGitignore(projectRoot, [], true);
  updateAgentsMd(projectRoot, [], false);
  console.log(pc.dim('\n  Cleaned .gitignore entries'));
  console.log(pc.green(`\n✔ Cleaned ${deletedCount} generated file${deletedCount !== 1 ? 's' : ''}.\n`));
}
