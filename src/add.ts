import fs from 'fs';
import path from 'path';
import pc from 'picocolors';
import { text, select, intro, outro, isCancel, multiselect } from '@clack/prompts';
import { syncAgents } from './sync';

function getDirectories(srcPath: string, rootPath: string): { label: string, value: string }[] {
  let dirs: { label: string, value: string }[] = [];
  const list = fs.readdirSync(srcPath, { withFileTypes: true });
  for (const item of list) {
    if (item.isDirectory()) {
      const fullPath = path.join(srcPath, item.name);
      dirs.push({
        label: path.relative(rootPath, fullPath) || '/',
        value: fullPath
      });
      dirs = dirs.concat(getDirectories(fullPath, rootPath));
    }
  }
  return dirs;
}

export async function addEntry(projectRoot: string, options?: { name?: string, globs?: string, description?: string }) {
  if (options?.name) {
    const baseDir = path.join(projectRoot, '.codebuddy');
    if (!fs.existsSync(baseDir)) {
      console.error(pc.red('No .codebuddy directory found. Run `npx create-code-buddy init` first.'));
      return;
    }
    const filePath = path.join(baseDir, options.name.endsWith('.md') ? options.name : `${options.name}.md`);
    
    let finalGlobs = '"*.*"';
    if (options.globs) {
      finalGlobs = options.globs.split(',').map(s => `"${s.trim().replace(/^"|"$/g, '')}"`).join(', ');
    }
    
    const description = options.description || 'Code Buddy Rule';
    const ruleName = path.basename(options.name).replace(/\.md$/, '');
    const fileContent = `---\ndescription: ${description}\nglobs: [${finalGlobs}]\n---\n\n# ${ruleName}\n\n[Add your rule content here]\n`;
    
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, fileContent);
    
    console.log(pc.green(`✔ Created ${path.relative(projectRoot, filePath)}`));
    await syncAgents(projectRoot);
    return;
  }

  console.clear();
  intro(pc.bgCyan(pc.black(` create-code-buddy: Add Entry/Directory `)));

  const baseDir = path.join(projectRoot, '.codebuddy');
  if (!fs.existsSync(baseDir)) {
    outro(pc.red('No .codebuddy directory found. Run `npx create-code-buddy init` first.'));
    return;
  }

  const action = await select({
    message: 'What would you like to create?',
    options: [
      { value: 'entry', label: 'File Entry (Markdown rule)' },
      { value: 'directory', label: 'Directory (Folder)' }
    ]
  });

  if (isCancel(action)) { outro(pc.yellow('Cancelled.')); return; }

  const dirs = [{ label: '/', value: baseDir }].concat(getDirectories(baseDir, baseDir));

  const targetDir = await select({
    message: 'Where should this be created?',
    options: dirs
  });

  if (isCancel(targetDir)) { outro(pc.yellow('Cancelled.')); return; }

  const name = await text({
    message: action === 'directory' ? 'Enter directory name:' : 'Enter filename (without .md):',
    validate: (val) => !val ? 'Name is required' : undefined
  });

  if (isCancel(name)) { outro(pc.yellow('Cancelled.')); return; }

  if (action === 'directory') {
    const newDirPath = path.join(targetDir as string, name as string);
    fs.mkdirSync(newDirPath, { recursive: true });
    outro(pc.green(`✔ Created directory ${path.relative(projectRoot, newDirPath)}`));
    return;
  }

  // File Entry Flow
  const description = await text({
    message: 'Enter a brief description for this rule:',
    placeholder: 'e.g., Frontend React standards'
  });
  if (isCancel(description)) { outro(pc.yellow('Cancelled.')); return; }

  const globChoices = await multiselect({
    message: 'Which files should trigger this rule? (Select all that apply)',
    options: [
      { value: '"*.*"', label: 'All Files (*.*)' },
      { value: '"*.tsx", "*.jsx", "*.vue", "*.svelte"', label: 'Frontend UI (*.tsx, *.vue, etc)' },
      { value: '"*.ts", "*.js", "*.go", "*.py", "*.cs"', label: 'Backend Logic (*.ts, *.go, etc)' },
      { value: '"*.test.*", "*.spec.*"', label: 'Testing (*.test.*, *.spec.*)' },
      { value: 'custom', label: 'Custom (Type your own)' }
    ],
    required: true
  });
  if (isCancel(globChoices)) { outro(pc.yellow('Cancelled.')); return; }

  let finalGlobs = (globChoices as string[]).filter(g => g !== 'custom').join(', ');

  if ((globChoices as string[]).includes('custom')) {
    const customGlob = await text({
      message: 'Enter your custom glob (e.g., "*.sql"):',
      placeholder: '*.sql'
    });
    if (isCancel(customGlob)) { outro(pc.yellow('Cancelled.')); return; }
    const customFormatted = `"${(customGlob as string).split(',').map(s => s.trim().replace(/^"|"$/g, '')).join('", "')}"`;
    finalGlobs = finalGlobs ? `${finalGlobs}, ${customFormatted}` : customFormatted;
  }

  if (!finalGlobs) finalGlobs = '"*.*"';

  const fileContent = `---\ndescription: ${description}\nglobs: [${finalGlobs}]\n---\n\n# ${name}\n\n[Add your rule content here]\n`;
  const filePath = path.join(targetDir as string, `${name}.md`);

  fs.writeFileSync(filePath, fileContent);
  
  const relPath = path.relative(projectRoot, filePath);
  // Terminal clickable link
  const link = `\x1b]8;;file://${filePath}\x1b\\${relPath}\x1b]8;;\x1b\\`;
  
  console.log(pc.green(`✔ Created Entry!`));
  console.log(pc.dim(`CMD+Click to edit: `) + pc.cyan(pc.underline(link)));

  console.log(pc.cyan(`\nSyncing updates...`));
  await syncAgents(projectRoot);
}
