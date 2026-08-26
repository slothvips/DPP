import JSZip from 'jszip';

const SUPPORTED_EXTENSIONS = new Set(['txt', 'text', 'md', 'markdown', 'xmind']);

export async function parseInputFile(file: File): Promise<string> {
  const extension = file.name.toLowerCase().split('.').pop();
  if (!extension || !SUPPORTED_EXTENSIONS.has(extension)) {
    throw new Error('仅支持 TXT、Markdown 和 XMind 文件');
  }

  const text = extension === 'xmind' ? await parseXMindFile(file) : await file.text();
  const normalizedText = text.trim();
  if (!normalizedText) {
    throw new Error('文件内容为空');
  }
  return normalizedText;
}

async function parseXMindFile(file: File): Promise<string> {
  let archive: JSZip;
  try {
    archive = await JSZip.loadAsync(await file.arrayBuffer());
  } catch {
    throw new Error('无法读取 XMind 文件，请确认文件没有损坏');
  }

  const jsonEntry = archive.file('content.json');
  if (jsonEntry) {
    try {
      const content = JSON.parse(await jsonEntry.async('text')) as unknown;
      return formatXMindJson(content);
    } catch (error) {
      if (error instanceof Error && error.message === 'XMind 文件中没有可解析的主题') {
        throw error;
      }
      throw new Error('无法解析 XMind 文件的内容');
    }
  }

  const xmlEntry = archive.file('content.xml');
  if (xmlEntry) {
    return formatXMindXml(await xmlEntry.async('text'));
  }

  throw new Error('XMind 文件缺少 content.json 或 content.xml');
}

function formatXMindJson(content: unknown): string {
  const sheets = Array.isArray(content) ? content : [content];
  const lines: string[] = [];

  for (const sheet of sheets) {
    const sheetObject = asRecord(sheet);
    const rootTopic = sheetObject?.rootTopic;
    if (!rootTopic) continue;

    const sheetTitle = readString(sheetObject, 'title');
    if (sheetTitle) lines.push(`# ${sheetTitle}`);
    appendJsonTopic(rootTopic, 0, lines);
  }

  if (lines.length === 0) {
    throw new Error('XMind 文件中没有可解析的主题');
  }
  return lines.join('\n');
}

function appendJsonTopic(topic: unknown, depth: number, lines: string[]): void {
  const topicObject = asRecord(topic);
  if (!topicObject) return;

  const title = readString(topicObject, 'title');
  if (title) lines.push(`${'  '.repeat(depth)}- ${title}`);

  const children = asRecord(topicObject.children);
  const attached = children?.attached;
  if (Array.isArray(attached)) {
    for (const child of attached) appendJsonTopic(child, depth + 1, lines);
  }
}

function formatXMindXml(content: string): string {
  const document = new DOMParser().parseFromString(content, 'application/xml');
  if (document.querySelector('parsererror')) {
    throw new Error('无法解析 XMind 文件的 XML 内容');
  }

  const lines: string[] = [];
  for (const sheet of Array.from(document.getElementsByTagName('sheet'))) {
    const sheetTitle = findDirectChild(sheet, 'title')?.textContent?.trim();
    if (sheetTitle) lines.push(`# ${sheetTitle}`);
    const rootTopic = findDirectChild(sheet, 'topic');
    if (rootTopic) appendXmlTopic(rootTopic, 0, lines);
  }

  if (lines.length === 0) {
    throw new Error('XMind 文件中没有可解析的主题');
  }
  return lines.join('\n');
}

function appendXmlTopic(topic: Element, depth: number, lines: string[]): void {
  const title = findDirectChild(topic, 'title')?.textContent?.trim();
  if (title) lines.push(`${'  '.repeat(depth)}- ${title}`);

  const children = findDirectChild(topic, 'children');
  const topics = children ? findDirectChild(children, 'topics') : undefined;
  if (!topics) return;

  for (const child of Array.from(topics.children)) {
    if (child.tagName === 'topic') appendXmlTopic(child, depth + 1, lines);
  }
}

function findDirectChild(element: Element, tagName: string): Element | undefined {
  return Array.from(element.children).find((child) => child.tagName === tagName);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function readString(record: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = record?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
