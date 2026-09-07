import fs from 'fs';
import path from 'path';
import pc from 'picocolors';
import { confirm, isCancel } from '@clack/prompts';
import { updateGitignore } from './sync';

export async function cleanAgents(projectRoot: string, isHard: boolean = false) {
  const folders = ['.cursor/rules', '.agents', '.github/instructions', 'agent-config'];
  
  if (isHard) {
    folders.push('.codebuddy');
  }
  
  const message = isHard 
    ? pc.red('⚠️  WARNING: Factory Reset ⚠️\n') + 'This will permanently delete your ENTIRE .codebuddy/ knowledge base along with all compiled agent folders. There is NO backup and this cannot be undone.\n\nAre you absolutely sure you want to obliterate these files?'
    : 'This will delete all compiled agent folders (.cursor/rules, .agents, etc) and clean your .gitignore. Your .codebuddy/ source rules will NOT be deleted. Continue?';

  const shouldClean = await confirm({
    message: message
  });

  if (isCancel(shouldClean) || !shouldClean) {
    console.log(pc.yellow('Clean cancelled.'));
    return;
  }

  let deletedCount = 0;
  for (const folder of folders) {
    const dirPath = path.join(projectRoot, folder);
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
      console.log(pc.dim(`Deleted ${folder}`));
      deletedCount++;
    }
  }

  // Clean the gitignore block
  updateGitignore(projectRoot, [], true);
  console.log(pc.dim(`Cleaned .gitignore entries`));

  if (isHard) {
    const pkgPath = path.join(projectRoot, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkgContent = fs.readFileSync(pkgPath, 'utf8');
        const pkg = JSON.parse(pkgContent);
        if (pkg.scripts && pkg.scripts.postinstall === 'npx create-code-buddy sync') {
          delete pkg.scripts.postinstall;
          if (Object.keys(pkg.scripts).length === 0) {
            delete pkg.scripts;
          }
          fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
          console.log(pc.dim(`Cleaned postinstall script from package.json`));
        }
      } catch (err) {
        // Silently fail if malformed
      }
    }
  }

  console.log(pc.green(`\n✔ Cleaned ${deletedCount} folders.`));
}
