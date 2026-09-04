import { db } from '@/db';
import { listPromptMaterials, listTestCaseMaterials } from '@/lib/db';
import { redactSensitiveText } from '@/utils/sensitive';
import { createToolParameter, toolRegistry } from '../tools';
import type { ToolHandler } from '../tools';
import {
  DPP_SEARCH_SOURCES,
  type DppSearchCandidate,
  type DppSearchSource,
  createSearchSnippet,
  searchDppCandidates,
} from './dppSearchShared';

async function dppSearch(args: { query: string; sources?: DppSearchSource[]; limit?: number }) {
  const sources = new Set(args.sources?.length ? args.sources : DPP_SEARCH_SOURCES);
  const candidates = (await Promise.all([...sources].map(loadSearchCandidates))).flat();
  const matches = searchDppCandidates(candidates, args.query);
  const limit = Math.min(Math.max(1, args.limit ?? 20), 50);

  return {
    query: args.query,
    total: matches.length,
    has_more: matches.length > limit,
    results: matches.slice(0, limit).map(({ source, id, title, text, updatedAt, url }) => ({
      source,
      id,
      title,
      snippet: redactSensitiveText(createSearchSnippet(text, args.query)),
      updated_at: updatedAt,
      ...(url ? { url: redactSensitiveText(url) } : {}),
    })),
  };
}

async function loadSearchCandidates(source: DppSearchSource): Promise<DppSearchCandidate[]> {
  switch (source) {
    case 'links':
      return (await db.links.filter((item) => !item.deletedAt).toArray()).map((item) => ({
        source,
        id: item.id,
        title: item.name,
        text: `${item.category}\n${item.note || ''}`,
        url: item.url,
        updatedAt: item.updatedAt,
      }));
    case 'blackboard':
      return (await db.blackboard.filter((item) => !item.deletedAt).toArray()).map((item) => ({
        source,
        id: item.id,
        title: item.content.split('\n')[0]?.slice(0, 100) || '便签',
        text: item.content,
        updatedAt: item.updatedAt,
      }));
    case 'prompts':
      return (await listPromptMaterials()).map((item) => ({
        source,
        id: item.id,
        title: item.title,
        text: `${item.content.summary || ''}\n${item.content.tags.join(' ')}\n${item.content.body}`,
        updatedAt: item.updatedAt,
      }));
    case 'test_cases':
      return (await listTestCaseMaterials()).map((item) => {
        const definition = item.content.definition;
        return {
          source,
          id: item.id,
          title: item.title,
          text: [
            definition.goal,
            ...definition.preconditions,
            ...definition.targets.flatMap((target) => [target.name || '', target.url]),
            ...definition.steps.flatMap((step) => [step.action, step.expectedResult || '']),
            definition.overallExpectedResult || '',
          ].join('\n'),
          updatedAt: item.updatedAt,
        };
      });
    case 'recordings': {
      const recordings: DppSearchCandidate[] = [];
      await db.recordings
        .orderBy('createdAt')
        .reverse()
        .each((item) => {
          recordings.push({
            source,
            id: item.id,
            title: item.title,
            text: item.url,
            url: item.url,
            updatedAt: item.createdAt,
          });
        });
      return recordings;
    }
    case 'jenkins':
      return (await db.jobs.toArray()).map((item) => ({
        source,
        id: item.url,
        title: item.name,
        text: `${item.fullName || ''}\n${item.env || ''}\n${item.lastStatus || ''}`,
        url: item.url,
        updatedAt: item.lastBuildTime || 0,
      }));
  }
}

export function registerDppSearchTools(): void {
  toolRegistry.register({
    name: 'dpp_search',
    description:
      '跨 DPP 的链接、便签、提示词、测试用例、录制元数据和 Jenkins 任务进行只读搜索，返回短摘要和可继续读取的 ID。',
    parameters: createToolParameter(
      {
        query: {
          type: 'string',
          maxLength: 500,
          description: '搜索关键词，空格分隔的词需要全部命中',
        },
        sources: {
          type: 'array',
          description: '限定搜索的数据源；不提供时搜索全部数据源',
          items: {
            type: 'string',
            enum: [...DPP_SEARCH_SOURCES],
            description: '数据源',
          },
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 50,
          description: '最多返回多少条，默认 20，最大 50',
        },
      },
      ['query']
    ),
    handler: dppSearch as ToolHandler,
  });
}
