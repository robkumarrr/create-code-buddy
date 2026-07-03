import fs from 'fs';
import path from 'path';
import { PromptAnswers } from './prompts';
import pc from 'picocolors';

export async function generateConfig(answers: PromptAnswers, projectRoot: string = process.cwd()) {
  const { framework, agent, addToGitignore } = answers;
  
  // Define where the files should go based on the chosen agent
  let targetDir = '';
  switch (agent) {
    case 'gemini':
      targetDir = '.gemini';
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

  // TODO: In a real environment, we would copy from a 'templates' directory packaged with the CLI.
  // For now, we simulate the template creation directly to ensure the structure is correct.
  
  if (!fs.existsSync(absoluteTargetDir)) {
    fs.mkdirSync(absoluteTargetDir, { recursive: true });
  }

  // Create some default template files based on the framework
  createTemplateFiles(absoluteTargetDir, framework, agent);
  
  console.log(pc.green(`\n✔ Scaffolding complete! Config generated at ${pc.bold(targetDir)}`));

  if (addToGitignore) {
    handleGitignore(projectRoot, targetDir);
  }
}

function createTemplateFiles(targetDir: string, framework: string, agent: string) {
  // We'll populate this with actual markdown content for the frameworks.
  // For now, writing basic scaffolding.
  
  let rootFileName = 'system_prompt.md';
  if (agent === 'gemini') rootFileName = 'AGENTS.md';
  if (agent === 'copilot') rootFileName = 'copilot-instructions.md';
  
  const rulesContent = `# ${framework.toUpperCase()} Guidelines\n\n- Strict typing\n- Best practices`;
  
  fs.writeFileSync(path.join(targetDir, rootFileName), rulesContent);
  
  if (agent === 'cursor') {
    // Cursor uses .mdc files
    const mdcContent = `---\ndescription: Guidelines for ${framework}\nglobs: ["*.*"]\n---\n\n${rulesContent}`;
    fs.writeFileSync(path.join(targetDir, `${framework}.mdc`), mdcContent);
  } else {
    // Other agents usually support a skills or rules folder
    const rulesDir = path.join(targetDir, 'rules');
    if (!fs.existsSync(rulesDir)) fs.mkdirSync(rulesDir);
    fs.writeFileSync(path.join(rulesDir, 'architecture.md'), `# Architecture for ${framework}\n\n...`);
    fs.writeFileSync(path.join(rulesDir, 'conventions.md'), `# Conventions for ${framework}\n\n...`);
  }

  // Create the specs directory (User's Boss System)
  const specsDir = path.join(targetDir, 'specs');
  if (!fs.existsSync(specsDir)) fs.mkdirSync(specsDir);
  
  const specContent = `# Implementation Spec Template\n\n## Goal\n[Describe the goal]\n\n## Architecture\n[Describe the architecture]\n\n## Step-by-Step\n1. [Step 1]\n2. [Step 2]`;
  fs.writeFileSync(path.join(specsDir, 'spec.md'), specContent);
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
