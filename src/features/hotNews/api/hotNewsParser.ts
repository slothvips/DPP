import type { DailyNews, NewsSection } from '@/features/hotNews/types';

function extractIconAndText(header: string): { icon: string; text: string } {
  const emojiMatch = header.match(/[\u{1F300}-\u{1F9FF}]/u);
  const icon = emojiMatch ? emojiMatch[0] : '📰';
  const text = header.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
  return { icon, text };
}

export function parseHotNewsMarkdown(markdown: string, date: string): DailyNews {
  const sections: NewsSection[] = [];
  const lines = markdown.split('\n');
  let currentSection: NewsSection | null = null;

  const sectionRegex = /^##\s+(.+)$/;
  const linkRegex = /^\d+\.\s+\[(.+?)\]\((.+?)\)/;
  const commentRegex = /^\s*>\s+(.*)$/;

  for (const line of lines) {
    const sectionMatch = line.match(sectionRegex);
    if (sectionMatch) {
      if (currentSection && currentSection.items.length > 0) {
        sections.push(currentSection);
      }

      const headerText = sectionMatch[1].trim();
      const { icon, text } = extractIconAndText(headerText);
      currentSection = {
        source: text,
        icon,
        items: [],
      };
      continue;
    }

    if (!currentSection) {
      continue;
    }

    const linkMatch = line.match(linkRegex);
    if (linkMatch) {
      currentSection.items.push({
        title: linkMatch[1],
        url: linkMatch[2],
        comment: '',
      });
      continue;
    }

    const commentMatch = line.match(commentRegex);
    if (commentMatch && currentSection.items.length > 0) {
      const lastItem = currentSection.items[currentSection.items.length - 1];
      if (lastItem.comment) {
        lastItem.comment += ` ${commentMatch[1].trim()}`;
      } else {
        lastItem.comment = commentMatch[1].trim();
      }
    }
  }

  if (currentSection && currentSection.items.length > 0) {
    sections.push(currentSection);
  }

  return { date, sections };
}
