import type { AgentAdapter } from './types';
import cursor from './cursor';
import claude from './claude';
import cline from './cline';
import copilot from './copilot';
import gemini from './gemini';
import windsurf from './windsurf';

export type { AgentAdapter } from './types';

/**
 * Every supported agent, in the order they've always been presented in
 * prompts and progress output. `sync.ts`, `clean.ts` and `prompts.ts` all
 * derive their per-agent lists from this single array now — previously each
 * maintained its own, and they had already drifted from one another once
 * (Gemini's folder moved in sync.ts without clean.ts's list following).
 */
export const ADAPTERS: AgentAdapter[] = [cline, claude, cursor, gemini, copilot, windsurf];

export const ADAPTER_IDS: string[] = ADAPTERS.map((adapter) => adapter.id);

export function getAdapter(id: string): AgentAdapter | undefined {
  return ADAPTERS.find((adapter) => adapter.id === id);
}
