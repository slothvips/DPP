import { useCallback, useMemo, useState } from 'react';
import type { HighlightPart, MatchResult, RegexFlagKey, RegexFlags } from './regexShared';

const PRESET_MAX_EXEC_TIME = 1000;

function safeIndexOf(str: string, searchValue: string, fromIndex: number): number {
  const result = str.indexOf(searchValue, fromIndex);
  return result >= 0 ? result : -1;
}

export function useRegexView() {
  const [pattern, setPattern] = useState('');
  const [testString, setTestString] = useState('');
  const [flags, setFlags] = useState<RegexFlags>({
    g: true,
    i: false,
    m: false,
    s: false,
    u: false,
  });
  const [copied, setCopied] = useState(false);

  const toggleFlag = useCallback((flag: RegexFlagKey) => {
    setFlags((prev) => ({ ...prev, [flag]: !prev[flag] }));
  }, []);

  const { regex, error, matches } = useMemo(() => {
    if (!pattern) {
      return { regex: null, error: null, matches: [] as MatchResult[] };
    }

    try {
      const flagStr = Object.entries(flags)
        .filter(([, enabled]) => enabled)
        .map(([key]) => key)
        .join('');
      const regex = new RegExp(pattern, flagStr);
      const results: MatchResult[] = [];

      if (flags.g) {
        const seen = new Set<number>();
        const startTime = Date.now();
        let match: RegExpExecArray | null;
        while ((match = regex.exec(testString)) !== null) {
          if (Date.now() - startTime > PRESET_MAX_EXEC_TIME) {
            return {
              regex: null,
              error: '正则表达式执行超时，请简化模式',
              matches: [] as MatchResult[],
            };
          }
          if (seen.has(match.index)) break;
          seen.add(match.index);
          const currentMatch = match;
          results.push({
            match: currentMatch[0],
            index: currentMatch.index,
            groups: currentMatch.groups
              ? Object.entries(currentMatch.groups).map(([name, value]) => ({
                  name,
                  value: value ?? '',
                  index: safeIndexOf(currentMatch[0], value ?? '', 0),
                }))
              : currentMatch.slice(1).map((value) => ({
                  value,
                  index: safeIndexOf(currentMatch[0], value, 0),
                })),
          });
          if (!currentMatch[0].length) regex.lastIndex++;
        }
      } else {
        const match = regex.exec(testString);
        if (match) {
          results.push({
            match: match[0],
            index: match.index,
            groups: match.groups
              ? Object.entries(match.groups).map(([name, value]) => ({
                  name,
                  value: value ?? '',
                  index: safeIndexOf(match[0], value ?? '', 0),
                }))
              : match.slice(1).map((value) => ({
                  value,
                  index: safeIndexOf(match[0], value, 0),
                })),
          });
        }
      }

      return { regex, error: null, matches: results };
    } catch (error) {
      return { regex: null, error: (error as Error).message, matches: [] as MatchResult[] };
    }
  }, [flags, pattern, testString]);

  const highlightedText = useMemo(() => {
    if (!regex || !testString || matches.length === 0) {
      return testString;
    }

    const parts: HighlightPart[] = [];
    let lastIndex = 0;

    for (const match of matches) {
      if (match.index > lastIndex) {
        parts.push({ text: testString.slice(lastIndex, match.index), highlighted: false });
      }
      parts.push({ text: match.match, highlighted: true });
      lastIndex = match.index + match.match.length;
    }

    if (lastIndex < testString.length) {
      parts.push({ text: testString.slice(lastIndex), highlighted: false });
    }

    return parts;
  }, [matches, regex, testString]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(matches.map((match) => match.match).join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [matches]);

  const applyPreset = (pattern: string, flag?: RegexFlagKey) => {
    setPattern(pattern);
    if (flag) {
      setFlags((prev) => ({ ...prev, [flag]: true }));
    }
  };

  return {
    applyPreset,
    copied,
    error,
    flags,
    handleCopy,
    highlightedText,
    matches,
    pattern,
    setPattern,
    setTestString,
    testString,
    toggleFlag,
  };
}
