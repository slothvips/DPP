// Default system prompt generator
import { buildPromptStaticSections } from './promptShared';

/**
 * Generate the default system prompt
 */
export function generateSystemPrompt(): string {
  return buildPromptStaticSections();
}
