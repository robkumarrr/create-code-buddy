import fs from 'fs';
import path from 'path';
import pc from 'picocolors';
import { text, confirm, intro, outro, isCancel } from '@clack/prompts';

const HEADER = `<!-- 
  🤖 CODE BUDDY AUTO-GENERATED FILE
  This file provides context to your AI agent.
  ✅ SAFE TO EDIT: You are encouraged to modify, add, or delete rules here!
-->

`;

export async function addRule(ruleName: string, projectRoot: string = process.cwd()) {
  console.clear();
  intro(pc.bgCyan(pc.black(` create-code-buddy: Adding rule '${ruleName}' `)));

  // Detect existing agent folders
  const possibleDirs = [
    '.cursor/rules',
    '.agents',
    '.gemini',
    '.github/instructions',
    'agent-config'
  ];

  let currentDir = projectRoot;
  let targetDir = '';
  let foundRoot = '';

  while (true) {
    for (const dir of possibleDirs) {
      if (fs.existsSync(path.join(currentDir, dir))) {
        targetDir = dir;
        foundRoot = currentDir;
        break;
      }
    }
    
    if (targetDir) break;

    // Stop if we hit a project boundary (package.json or .git)
    if (fs.existsSync(path.join(currentDir, 'package.json')) || fs.existsSync(path.join(currentDir, '.git'))) {
      break;
    }

    const parentDir = path.dirname(currentDir);
    // Stop if we hit the filesystem root
    if (parentDir === currentDir) break;
    currentDir = parentDir;
  }

  if (!targetDir) {
    outro(pc.red(`No agent configuration folder found within the project boundaries. Please run 'npx create-code-buddy' first to initialize.`));
    return;
  }

  projectRoot = foundRoot;

  const isCursor = targetDir === '.cursor/rules';
  const ext = isCursor ? '.mdc' : '.md';
  const fileName = `${ruleName}${ext}`;
  
  // If not cursor, place rules in the `rules` subdirectory for structure, unless they are using copilot root file only (rare)
  let saveDir = path.join(projectRoot, targetDir);
  if (!isCursor && fs.existsSync(path.join(saveDir, 'rules'))) {
    saveDir = path.join(saveDir, 'rules');
  }
  
  const targetPath = path.join(saveDir, fileName);

  if (fs.existsSync(targetPath)) {
    const shouldOverwrite = await confirm({
      message: `Rule ${fileName} already exists in ${path.relative(projectRoot, saveDir)}. Do you want to overwrite it?`
    });
    if (isCancel(shouldOverwrite) || !shouldOverwrite) {
      outro(pc.yellow('Aborted.'));
      return;
    }
  }

  const description = await text({
    message: 'Enter a brief description for this rule (or press Enter to skip):',
    placeholder: 'e.g., Database interaction guidelines'
  });
  if (isCancel(description)) return;

  let fileContent = '';
  if (isCursor) {
    const globs = await text({
      message: 'Enter globs for this rule (e.g., *.ts, *.tsx) or press Enter to skip (defaults to *.*):',
      placeholder: '*.ts, *.tsx'
    });
    if (isCancel(globs)) return;

    const finalGlobs = globs ? `"${(globs as string).split(',').map(s => s.trim()).join('", "')}"` : '"*.*"';
    const finalDesc = description ? description as string : `Custom rule for ${ruleName}`;
    fileContent = `---\ndescription: ${finalDesc}\nglobs: [${finalGlobs}]\n---\n\n# ${ruleName}\n\n[Add your rule content here]`;
  } else {
    fileContent = `# ${ruleName}\n\n${description ? `> ${description as string}\n\n` : ''}[Add your rule content here]`;
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, HEADER + fileContent);
  outro(pc.green(`✔ Created ${path.relative(projectRoot, targetPath)}!`));
}
