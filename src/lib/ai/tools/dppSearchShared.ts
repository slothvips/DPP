export const DPP_SEARCH_SOURCES = [
  'links',
  'blackboard',
  'prompts',
  'test_cases',
  'recordings',
  'jenkins',
] as const;

export type DppSearchSource = (typeof DPP_SEARCH_SOURCES)[number];

export interface DppSearchCandidate {
  source: DppSearchSource;
  id: string;
  title: string;
  text: string;
  updatedAt: number;
  url?: string;
}

export function searchDppCandidates(
  candidates: DppSearchCandidate[],
  query: string
): DppSearchCandidate[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return candidates
    .filter((candidate) => {
      const haystack =
        `${candidate.title}\n${candidate.text}\n${candidate.url || ''}`.toLocaleLowerCase();
      return terms.every((term) => haystack.includes(term));
    })
    .sort((left, right) => {
      const normalizedQuery = query.trim().toLocaleLowerCase();
      const leftTitleMatch = left.title.toLocaleLowerCase().includes(normalizedQuery) ? 1 : 0;
      const rightTitleMatch = right.title.toLocaleLowerCase().includes(normalizedQuery) ? 1 : 0;
      return rightTitleMatch - leftTitleMatch || right.updatedAt - left.updatedAt;
    });
}

export function createSearchSnippet(text: string, query: string, maxLength = 240): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) return compact;
  const firstTerm = query.trim().split(/\s+/)[0]?.toLocaleLowerCase() || '';
  const matchIndex = firstTerm ? compact.toLocaleLowerCase().indexOf(firstTerm) : -1;
  const start = Math.max(0, Math.min(matchIndex - 60, compact.length - maxLength));
  return `${start > 0 ? '...' : ''}${compact.slice(start, start + maxLength)}${
    start + maxLength < compact.length ? '...' : ''
  }`;
}
