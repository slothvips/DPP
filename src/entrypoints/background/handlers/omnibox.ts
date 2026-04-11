import { browser } from 'wxt/browser';
import { handleOmniboxInputEntered } from './omniboxActions';
import { searchOmnibox } from './omniboxSearch';

export { searchOmnibox } from './omniboxSearch';

export function setupOmnibox() {
  browser.omnibox.onInputChanged.addListener(async (text, suggest) => {
    if (!text) return;

    const suggestions = await searchOmnibox(text);

    if (suggestions.length > 0) {
      const first = suggestions[0];
      browser.omnibox.setDefaultSuggestion({
        description: first.description,
      });
      suggest(suggestions.slice(1));
      return;
    }

    browser.omnibox.setDefaultSuggestion({
      description: '没有找到匹配项',
    });
    suggest([]);
  });

  browser.omnibox.onInputEntered.addListener((text) => {
    void handleOmniboxInputEntered(text);
  });
}
