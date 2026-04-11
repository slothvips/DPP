import { logger } from '@/utils/logger';
import { mapOllamaResponse, stripThinkingContent } from './ollamaShared';
import type { ChatResponse, OllamaChatRequest, OllamaChatResponse } from './types';

export async function handleOllamaStreamingChat(
  url: string,
  requestBody: OllamaChatRequest,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal
): Promise<ChatResponse> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...requestBody, stream: true }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Ollama streaming error: ${response.status} ${response.statusText}`);
  }

  if (!response.body) {
    throw new Error('No response body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullContent = '';
  let buffer = '';
  let finalToolCalls: ChatResponse['message']['toolCalls'];
  let done = false;

  const processLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }

    try {
      const data = JSON.parse(trimmed) as OllamaChatResponse;
      if (data.message?.content) {
        fullContent += data.message.content;
        onChunk(data.message.content);
      }
      if (data.message?.tool_calls?.length) {
        finalToolCalls = data.message.tool_calls;
      }
      if (data.done) {
        done = true;
      }
    } catch (error) {
      logger.debug('Failed to parse Ollama response:', error);
    }
  };

  try {
    while (true) {
      if (signal?.aborted) {
        logger.info('[Ollama] Streaming aborted by user');
        break;
      }

      const { done: streamDone, value } = await reader.read();
      if (streamDone) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        processLine(line);
      }
    }

    if (buffer.trim()) {
      processLine(buffer);
    }
  } finally {
    reader.releaseLock();
  }

  return mapOllamaResponse({
    message: {
      role: 'assistant',
      content: stripThinkingContent(fullContent),
      tool_calls: finalToolCalls,
    },
    done,
  });
}
