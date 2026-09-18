import fs from 'fs';
import path from 'path';
import pc from 'picocolors';
import { intro, outro, select, isCancel } from '@clack/prompts';
import { exec } from 'child_process';
import { SSOT_DIR, TOOL_NAME, rulesRoot } from './core/constants';
import { getRuleFiles } from './core/fs';

export async function listRules(projectRoot: string = process.cwd()) {
  console.clear();
  intro(pc.bgCyan(pc.black(` ${TOOL_NAME}: Navigating Rules `)));

  const codebuddyDir = path.join(projectRoot, SSOT_DIR);

  if (!fs.existsSync(codebuddyDir)) {
    outro(pc.red(`No ${SSOT_DIR} folder found. Please run 'npx ${TOOL_NAME} init' first.`));
    process.exitCode = 1;
    return;
  }

  const files = getRuleFiles(rulesRoot(projectRoot)).map((f) => f.abs);

  if (files.length === 0) {
    outro(pc.yellow(`No markdown rules found in ${SSOT_DIR}.`));
    return;
  }

  const options = files.map(file => {
    const relativePath = path.relative(projectRoot, file);
    return {
      value: file,
      label: relativePath
    };
  });

  const selectedFile = await select({
    message: 'Select a rule to view/edit:',
    options: options,
  });

  if (isCancel(selectedFile)) {
    outro(pc.yellow('Navigation cancelled.'));
    return;
  }

  const fileToOpen = selectedFile as string;
  const relPath = path.relative(projectRoot, fileToOpen);
  
  outro(pc.green(`✔ Selected Entry! `) + pc.dim(`Open this file in your editor: `) + pc.cyan(relPath));
}
