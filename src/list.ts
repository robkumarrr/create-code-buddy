import fs from 'fs';
import path from 'path';
import pc from 'picocolors';
import { intro, outro, select, isCancel } from '@clack/prompts';
import { exec } from 'child_process';

function getOpenCommand(filePath: string): string {
  const platform = process.platform;
  if (platform === 'darwin') return `open "${filePath}"`;
  if (platform === 'win32') return `start "" "${filePath}"`;
  return `xdg-open "${filePath}"`;
}

function findAgentDir(startDir: string): { root: string, dir: string } | null {
  const possibleDirs = [
    '.cursor/rules',
    '.agents',
    '.gemini',
    '.github/instructions',
    'agent-config'
  ];

  let currentDir = startDir;

  while (true) {
    for (const dir of possibleDirs) {
      if (fs.existsSync(path.join(currentDir, dir))) {
        return { root: currentDir, dir };
      }
    }
    if (fs.existsSync(path.join(currentDir, 'package.json')) || fs.existsSync(path.join(currentDir, '.git'))) {
      break;
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) break;
    currentDir = parentDir;
  }
  return null;
}

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

  const agentConfig = findAgentDir(projectRoot);

  if (!agentConfig) {
    outro(pc.red(`No agent configuration folder found. Please run 'npx create-code-buddy init' first.`));
    return;
  }

  const targetPath = path.join(agentConfig.root, agentConfig.dir);
  const files = getMarkdownFiles(targetPath);

  if (files.length === 0) {
    outro(pc.yellow(`No markdown rules found in ${agentConfig.dir}.`));
    return;
  }

  // Create relative paths for display
  const options = files.map(file => {
    const relativePath = path.relative(agentConfig.root, file);
    return {
      value: file,
      label: relativePath
    };
  });

  const selectedFile = await select({
    message: 'Select a rule to open in your editor:',
    options: options,
  });

  if (isCancel(selectedFile)) {
    outro(pc.yellow('Navigation cancelled.'));
    return;
  }

  const fileToOpen = selectedFile as string;
  const cmd = getOpenCommand(fileToOpen);
  
  exec(cmd, (error) => {
    if (error) {
      outro(pc.red(`Failed to open file: ${error.message}`));
    } else {
      outro(pc.green(`✔ Opened ${path.relative(agentConfig.root, fileToOpen)}`));
    }
  });
}
