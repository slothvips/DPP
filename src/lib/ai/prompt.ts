// System prompt generator for D仔
import {
  buildPromptStaticSections,
  getPromptConfirmationSection,
  getPromptToolDescriptions,
} from './promptShared';

/**
 * Generate system prompt for D仔
 */
export function generateSystemPrompt(): string {
  return buildPromptStaticSections({
    toolDescriptions: getPromptToolDescriptions(),
    confirmationSection: getPromptConfirmationSection(),
  });
}
