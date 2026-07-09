import fs from 'fs';
import path from 'path';
import { PromptAnswers } from './prompts';
import pc from 'picocolors';
import { select, isCancel, spinner } from '@clack/prompts';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const HEADER = `<!-- 
  🤖 CODE BUDDY AUTO-GENERATED FILE
  This file provides context to your AI agent.
  ✅ SAFE TO EDIT: You are encouraged to modify, add, or delete rules here!
-->

`;

export async function generateConfig(answers: PromptAnswers, projectRoot: string = process.cwd(), disableMinimizer: boolean = false) {
  const createdFiles: string[] = [];
  const { framework, agent, addToGitignore, laravelBoost, options } = answers;
  
  if (laravelBoost === 'boost_only' || laravelBoost === 'both') {
    const s = spinner();
    s.start('Installing Laravel Boost via composer...');
    try {
      await execAsync('composer require laravel/boost --dev', { cwd: projectRoot });
      await execAsync('php artisan boost:install', { cwd: projectRoot });
      s.stop('✔ Laravel Boost installed successfully!');
    } catch (e: any) {
      s.stop(pc.red('Failed to install Laravel Boost. Is composer in your PATH?'));
      console.log(pc.dim(e.message));
    }
    
    if (laravelBoost === 'boost_only') {
      console.log(pc.green(`\n✔ Setup complete! Laravel Boost is handling your agent rules.`));
      return;
    }
  }

  let targetDir = '';
  switch (agent) {
    case 'gemini':
      targetDir = '.agents'; // Updated to open source standard
      break;
    case 'cursor':
      targetDir = '.cursor/rules';
      break;
    case 'copilot':
      targetDir = '.github/instructions';
      break;
    case 'generic':
    default:
      targetDir = 'agent-config';
      break;
  }

  const absoluteTargetDir = path.join(projectRoot, targetDir);
  
  if (!fs.existsSync(absoluteTargetDir)) {
    fs.mkdirSync(absoluteTargetDir, { recursive: true });
  }

  await createTemplateFiles(absoluteTargetDir, framework, agent, createdFiles, disableMinimizer, options || {});
  
  console.log(pc.green(`\n✔ Scaffolding complete! Config generated at ${pc.bold(targetDir)}`));
  if (!disableMinimizer) {
    console.log(pc.cyan(`⚡ Token Minimization is ACTIVE. Your agent will use progressive disclosure and strict globs to save tokens and stay smart.`));
  }
  
  if (createdFiles.length > 0) {
    console.log(pc.dim(`\n💡 Don't like it? To undo these changes, simply delete the following:`));
    createdFiles.forEach(f => console.log(pc.dim(`   - ${path.relative(projectRoot, f)}`)));
  }

  if (addToGitignore) {
    handleGitignore(projectRoot, targetDir);
  }
}

async function safeWriteFile(filePath: string, content: string, createdFiles: string[]) {
  if (fs.existsSync(filePath)) {
    const filename = path.basename(filePath);
    const action = await select({
      message: `Conflict: ${pc.yellow(filename)} already exists. What would you like to do?`,
      options: [
        { value: 'skip', label: 'Skip (Keep existing file)' },
        { value: 'overwrite', label: 'Overwrite (Replace with new template)' }
      ]
    });

    if (isCancel(action) || action === 'skip') {
      console.log(pc.dim(`Skipped ${filename}`));
      return;
    }
  }

  fs.writeFileSync(filePath, HEADER + content);
  createdFiles.push(filePath);
}

import ejs from 'ejs';

function renderTemplate(framework: string, templateName: string, options: Record<string, string>): string {
  const templatePath = path.join(__dirname, '../templates', framework, `${templateName}.md.ejs`);
  if (fs.existsSync(templatePath)) {
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    return ejs.render(templateContent, { options });
  }
  return `# ${templateName.toUpperCase()} for ${framework}\n\n...`;
}

async function createTemplateFiles(targetDir: string, framework: string, agent: string, createdFiles: string[], disableMinimizer: boolean, options: Record<string, string>) {
  const architectureContent = renderTemplate(framework, 'architecture', options);
  const testingContent = renderTemplate(framework, 'testing', options);
  const conventionsContent = renderTemplate(framework, 'conventions', options);
  const uiContent = renderTemplate(framework, 'ui_aesthetics', options);

  if (agent === 'cursor') {
    // Cursor uses individual .mdc files with globs for token minimization
    const testGlob = disableMinimizer ? '"*.*"' : '"*.test.*", "*.spec.*", "**/__tests__/**"';
    const uiGlob = disableMinimizer ? '"*.*"' : '"*.css", "*.tsx", "*.jsx", "*.vue", "*.svelte"';
    const logicGlob = disableMinimizer ? '"*.*"' : '"*.ts", "*.js", "*.php", "*.cs"';

    const architectureMdc = `---\ndescription: Architecture rules for ${framework}\nglobs: ["*.*"]\n---\n\n${architectureContent}`;
    const testingMdc = `---\ndescription: Testing guidelines for ${framework}\nglobs: [${testGlob}]\n---\n\n${testingContent}`;
    const conventionsMdc = `---\ndescription: Coding conventions for ${framework}\nglobs: [${logicGlob}]\n---\n\n${conventionsContent}`;
    const uiMdc = `---\ndescription: UI Aesthetics and styling rules\nglobs: [${uiGlob}]\n---\n\n${uiContent}`;

    await safeWriteFile(path.join(targetDir, 'architecture.mdc'), architectureMdc, createdFiles);
    await safeWriteFile(path.join(targetDir, 'testing.mdc'), testingMdc, createdFiles);
    await safeWriteFile(path.join(targetDir, 'conventions.mdc'), conventionsMdc, createdFiles);
    await safeWriteFile(path.join(targetDir, 'ui_aesthetics.mdc'), uiMdc, createdFiles);
  } else {
    // Other agents rely on a root file and sub-folders
    let rootFileName = 'system_prompt.md';
    if (agent === 'gemini') rootFileName = 'AGENTS.md';
    if (agent === 'copilot') rootFileName = 'copilot-instructions.md';
    
    let rootContent = `# ${framework.toUpperCase()} Agent Instructions\n`;
    if (!disableMinimizer) {
      rootContent += `\n**PROGRESSIVE DISCLOSURE ACTIVE**: Do NOT load all rules at once. Read the specific files in the \`rules/\` directory only when your task requires them (e.g., read \`rules/testing.md\` only when writing tests).\n`;
    } else {
      rootContent += `\nRead all rules in the \`rules/\` directory and keep them in mind for every prompt.\n`;
    }

    await safeWriteFile(path.join(targetDir, rootFileName), rootContent, createdFiles);

    const rulesDir = path.join(targetDir, 'rules');
    if (!fs.existsSync(rulesDir)) fs.mkdirSync(rulesDir);
    await safeWriteFile(path.join(rulesDir, 'architecture.md'), architectureContent, createdFiles);
    await safeWriteFile(path.join(rulesDir, 'conventions.md'), conventionsContent, createdFiles);
    await safeWriteFile(path.join(rulesDir, 'testing.md'), testingContent, createdFiles);
    await safeWriteFile(path.join(rulesDir, 'ui_aesthetics.md'), uiContent, createdFiles);
  }

  const specsDir = path.join(targetDir, 'specs');
  if (!fs.existsSync(specsDir)) fs.mkdirSync(specsDir);
  
  const specContent = `# Implementation Spec Template\n\n## Goal\n[Describe the goal]\n\n## Architecture\n[Describe the architecture]\n\n## Step-by-Step\n1. [Step 1]\n2. [Step 2]`;
  await safeWriteFile(path.join(specsDir, 'spec.md'), specContent, createdFiles);
}

function handleGitignore(projectRoot: string, targetDir: string) {
  const gitignorePath = path.join(projectRoot, '.gitignore');
  const ignoreEntry = `\n# Agent Rules\n${targetDir.split('/')[0]}\n`;
  
  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, 'utf8');
    if (!content.includes(targetDir.split('/')[0])) {
      fs.appendFileSync(gitignorePath, ignoreEntry);
      console.log(pc.dim(`Added ${targetDir.split('/')[0]} to .gitignore`));
    }
  } else {
    fs.writeFileSync(gitignorePath, ignoreEntry);
    console.log(pc.dim(`Created .gitignore and added ${targetDir.split('/')[0]}`));
  }
}
