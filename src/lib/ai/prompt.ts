// System prompt generator for D仔
import { buildPromptStaticSections } from './promptShared';

/**
 * Generate system prompt for D仔
 */
export function generateSystemPrompt(): string {
  return buildPromptStaticSections();
}
