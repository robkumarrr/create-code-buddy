import fs from 'fs';
import path from 'path';
import pc from 'picocolors';
import { text, confirm, intro, outro } from '@clack/prompts';

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

  let targetDir = '';
  for (const dir of possibleDirs) {
    if (fs.existsSync(path.join(projectRoot, dir))) {
      targetDir = dir;
      break;
    }
  }

  if (!targetDir) {
    outro(pc.red(`No agent configuration folder found. Please run 'npx create-code-buddy' first to initialize.`));
    return;
  }

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
    outro(pc.yellow(`Rule ${fileName} already exists in ${path.relative(projectRoot, saveDir)}.`));
    return;
  }

  const description = await text({
    message: 'Enter a brief description for this rule (or press Enter to skip):',
    placeholder: 'e.g., Database interaction guidelines',
    required: false
  });

  let fileContent = '';
  if (isCursor) {
    const globs = await text({
      message: 'Enter globs for this rule (e.g., *.ts, *.tsx) or press Enter to skip (defaults to *.*):',
      placeholder: '*.ts, *.tsx',
      required: false
    });

    const finalGlobs = globs ? `"${(globs as string).split(',').map(s => s.trim()).join('", "')}"` : '"*.*"';
    const finalDesc = description ? description as string : `Custom rule for ${ruleName}`;
    fileContent = `---\ndescription: ${finalDesc}\nglobs: [${finalGlobs}]\n---\n\n# ${ruleName}\n\n[Add your rule content here]`;
  } else {
    fileContent = `# ${ruleName}\n\n${description ? `> ${description}\n\n` : ''}[Add your rule content here]`;
  }

  fs.writeFileSync(targetPath, HEADER + fileContent);
  outro(pc.green(`✔ Created ${path.relative(projectRoot, targetPath)}!`));
}
