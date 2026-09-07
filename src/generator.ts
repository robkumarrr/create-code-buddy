import fs from 'fs';
import path from 'path';
import pc from 'picocolors';
import { PromptAnswers } from './prompts';
import { BASELINE_RULES } from './defaults';
import { syncAgents } from './sync';

export async function generateConfig(answers: PromptAnswers, projectRoot: string) {
  const codebuddyDir = path.join(projectRoot, '.codebuddy');
  if (!fs.existsSync(codebuddyDir)) {
    fs.mkdirSync(codebuddyDir, { recursive: true });
  }

  // 0. Optionally add postinstall script
  if (answers.addPostinstall) {
    const pkgPath = path.join(projectRoot, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkgContent = fs.readFileSync(pkgPath, 'utf8');
        const pkg = JSON.parse(pkgContent);
        if (!pkg.scripts) pkg.scripts = {};
        pkg.scripts.postinstall = 'npx create-code-buddy sync';
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
      } catch (err) {
        // Silently fail or log if package.json is malformed
      }
    }
  }

  // 1. Write the config file
  const configPath = path.join(codebuddyDir, 'config.json');
  const config = {
    agents: answers.agents,
    gitignore_compiled_agents: answers.addToGitignore
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  // 2. Write the baseline SSOT rules
  let createdCount = 0;
  for (const [filename, template] of Object.entries(BASELINE_RULES)) {
    const filePath = path.join(codebuddyDir, filename);
    if (!fs.existsSync(filePath)) {
      const fileContent = `---\ndescription: ${template.description}\nglobs: [${template.globs}]\n---\n\n${template.content}`;
      fs.writeFileSync(filePath, fileContent);
      createdCount++;
    }
  }

  console.log(pc.green(`\n✔ Initialized Code Buddy SSOT at ${pc.bold('.codebuddy/')}`));
  if (createdCount > 0) {
    console.log(pc.dim(`   Scaffolded ${createdCount} baseline rules.`));
  }

  // 3. Immediately trigger a sync to compile for the selected agents
  console.log(pc.cyan(`\nCompiling rules for your selected agents...`));
  await syncAgents(projectRoot);
}
