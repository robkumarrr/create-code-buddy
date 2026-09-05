import fs from 'fs';
import path from 'path';
import pc from 'picocolors';
import { confirm, isCancel } from '@clack/prompts';
import { updateGitignore } from './sync';

export async function cleanAgents(projectRoot: string) {
  const folders = ['.cursor/rules', '.agents', '.github/instructions', 'agent-config'];
  
  const shouldClean = await confirm({
    message: 'This will delete all compiled agent folders (.cursor/rules, .agents, etc) and clean your .gitignore. Your .codebuddy/ source rules will NOT be deleted. Continue?'
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

  console.log(pc.green(`\n✔ Cleaned ${deletedCount} compiled agent folders.`));
}
