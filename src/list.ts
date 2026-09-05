import fs from 'fs';
import path from 'path';
import pc from 'picocolors';
import { intro, outro, select, isCancel } from '@clack/prompts';
import { exec } from 'child_process';


function getMarkdownFiles(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of list) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      results = results.concat(getMarkdownFiles(fullPath));
    } else if (item.name.endsWith('.md') || item.name.endsWith('.mdc')) {
      results.push(fullPath);
    }
  }
  return results;
}

export async function listRules(projectRoot: string = process.cwd()) {
  console.clear();
  intro(pc.bgCyan(pc.black(` create-code-buddy: Navigating Rules `)));

  const codebuddyDir = path.join(projectRoot, '.codebuddy');

  if (!fs.existsSync(codebuddyDir)) {
    outro(pc.red(`No .codebuddy folder found. Please run 'npx create-code-buddy init' first.`));
    return;
  }

  const files = getMarkdownFiles(codebuddyDir);

  if (files.length === 0) {
    outro(pc.yellow(`No markdown rules found in .codebuddy.`));
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
  const link = `\x1b]8;;file://${fileToOpen}\x1b\\${relPath}\x1b]8;;\x1b\\`;
  
  outro(pc.green(`✔ Selected Entry! `) + pc.dim(`CMD+Click to edit: `) + pc.cyan(pc.underline(link)));
}
