import fs from 'fs';
import path from 'path';
import pc from 'picocolors';

export interface CodeBuddyConfig {
  agents: string[];
  gitignore_compiled_agents: boolean;
}

export function getConfig(projectRoot: string): CodeBuddyConfig | null {
  const configPath = path.join(projectRoot, '.codebuddy', 'config.json');
  if (!fs.existsSync(configPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    return null;
  }
}

function getMarkdownFiles(dir: string, baseDir: string = dir): { abs: string, rel: string }[] {
  if (!fs.existsSync(dir)) return [];
  let results: { abs: string, rel: string }[] = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of list) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      results = results.concat(getMarkdownFiles(fullPath, baseDir));
    } else if (item.name.endsWith('.md')) {
      results.push({
        abs: fullPath,
        rel: path.relative(baseDir, fullPath)
      });
    }
  }
  return results;
}

function parseFrontmatter(content: string) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { attributes: {}, body: content };
  
  const frontmatter = match[1];
  const body = match[2];
  const attributes: Record<string, string> = {};
  
  frontmatter.split('\n').forEach(line => {
    const splitIndex = line.indexOf(':');
    if (splitIndex > 0) {
      const key = line.slice(0, splitIndex).trim();
      const value = line.slice(splitIndex + 1).trim();
      attributes[key] = value;
    }
  });
  
  return { attributes, body };
}

export function updateGitignore(projectRoot: string, foldersToIgnore: string[], remove: boolean = false) {
  const gitignorePath = path.join(projectRoot, '.gitignore');
  const START_MARKER = '# --- Create Code Buddy (Start) ---';
  const END_MARKER = '# --- Create Code Buddy (End) ---';
  
  let content = '';
  if (fs.existsSync(gitignorePath)) {
    content = fs.readFileSync(gitignorePath, 'utf8');
  }

  let startIndex = content.indexOf(START_MARKER);
  while (startIndex !== -1) {
    const endIndex = content.indexOf(END_MARKER, startIndex);
    if (endIndex !== -1) {
      // Find the start of the line with the START_MARKER
      const lineStart = content.lastIndexOf('\n', startIndex) === -1 ? 0 : content.lastIndexOf('\n', startIndex);
      const after = content.substring(endIndex + END_MARKER.length);
      content = content.substring(0, lineStart) + after;
    } else {
      break;
    }
    startIndex = content.indexOf(START_MARKER);
  }

  if (!remove && foldersToIgnore.length > 0) {
    const block = `\n${START_MARKER}\n${foldersToIgnore.join('\n')}\n${END_MARKER}\n`;
    content = content.trim() + '\n' + block;
  }

  content = content.trim() + '\n';
  
  // Only write if there's actual content or if we had a file before
  if (content.trim() || fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, content);
  }
}

export async function syncAgents(projectRoot: string) {
  const config = getConfig(projectRoot);
  if (!config) {
    console.error(pc.red('No .codebuddy/config.json found. Run `npx create-code-buddy init` first.'));
    return;
  }

  const ssotDir = path.join(projectRoot, '.codebuddy');
  const files = getMarkdownFiles(ssotDir);

  const foldersToIgnore: string[] = [];

  for (const agent of config.agents) {
    if (agent === 'cursor') {
      const targetBase = path.join(projectRoot, '.cursor', 'rules');
      foldersToIgnore.push('.cursor/');
      
      for (const file of files) {
        const rawContent = fs.readFileSync(file.abs, 'utf8');
        const { attributes, body } = parseFrontmatter(rawContent);
        
        const mdcName = file.rel.replace(/\.md$/, '.mdc');
        const targetAbs = path.join(targetBase, mdcName);
        
        fs.mkdirSync(path.dirname(targetAbs), { recursive: true });
        
        const mdcContent = `---\ndescription: ${attributes.description || 'Code Buddy Rule'}\nglobs: ${attributes.globs || '"*.*"'}\n---\n\n${body}`;
        fs.writeFileSync(targetAbs, mdcContent);
      }
      console.log(pc.green(`✔ Compiled to Cursor (.cursor/rules)`));
    }
    
    if (agent === 'gemini') {
      const targetBase = path.join(projectRoot, '.agents');
      foldersToIgnore.push('.agents/');
      
      for (const file of files) {
        const rawContent = fs.readFileSync(file.abs, 'utf8');
        const targetAbs = path.join(targetBase, file.rel);
        
        fs.mkdirSync(path.dirname(targetAbs), { recursive: true });
        fs.writeFileSync(targetAbs, rawContent);
      }
      console.log(pc.green(`✔ Compiled to Gemini (.agents/rules)`));
    }
    
    if (agent === 'copilot') {
      const targetBase = path.join(projectRoot, '.github', 'instructions');
      foldersToIgnore.push('.github/instructions/');
      
      for (const file of files) {
        const rawContent = fs.readFileSync(file.abs, 'utf8');
        const targetAbs = path.join(targetBase, file.rel);
        
        fs.mkdirSync(path.dirname(targetAbs), { recursive: true });
        fs.writeFileSync(targetAbs, rawContent);
      }
      console.log(pc.green(`✔ Compiled to Copilot (.github/instructions)`));
    }
    
    if (agent === 'generic') {
      const targetBase = path.join(projectRoot, 'agent-config');
      foldersToIgnore.push('agent-config/');
      
      for (const file of files) {
        const rawContent = fs.readFileSync(file.abs, 'utf8');
        const targetAbs = path.join(targetBase, file.rel);
        
        fs.mkdirSync(path.dirname(targetAbs), { recursive: true });
        fs.writeFileSync(targetAbs, rawContent);
      }
      console.log(pc.green(`✔ Compiled to Generic (agent-config/rules)`));
    }
  }

  updateGitignore(projectRoot, foldersToIgnore, !config.gitignore_compiled_agents);
}
