import { appendStreamChunk, createStreamAccumulator, shouldEmitStreamUpdate } from './streamShared';
import { type NetworkRequestData, STREAMING_CONTENT_TYPES } from './types';
import { emitNetworkEvent } from './utils';

export function isStreamingContentType(contentType: string): boolean {
  return STREAMING_CONTENT_TYPES.some((type) => contentType.includes(type));
}

export async function safeReadResponseBody(
  response: Response,
  contentType: string
): Promise<string> {
  try {
    const clonedResponse = response.clone();
    if (contentType.includes('application/json') || contentType.includes('text/')) {
      return await clonedResponse.text();
    }
    if (
      contentType.includes('image/') ||
      contentType.includes('audio/') ||
      contentType.includes('video/')
    ) {
      const blob = await clonedResponse.blob();
      return `[Binary: ${blob.size} bytes, type: ${contentType}]`;
    }
    return `[${contentType || 'Unknown type'}]`;
  } catch {
    return '[Unable to read response body]';
  }
}

export async function streamResponseBody(
  response: Response,
  networkData: NetworkRequestData,
  contentType: string
): Promise<string> {
  const stream = createStreamAccumulator();
  const decoder = new TextDecoder();

  try {
    const clonedResponse = response.clone();
    const reader = clonedResponse.body?.getReader();

    if (!reader) {
      return safeReadResponseBody(response, contentType);
    }

    const contentLength = response.headers.get('content-length');
    const totalBytes = contentLength ? parseInt(contentLength, 10) : undefined;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunkText = decoder.decode(value, { stream: true });
      appendStreamChunk(stream, chunkText, value.byteLength);

      if (shouldEmitStreamUpdate(stream)) {
        emitNetworkEvent({
          ...networkData,
          phase: 'response-body',
          isStreaming: true,
          streamChunks: [...stream.chunks],
          receivedBytes: stream.receivedBytes,
          totalBytes,
          responseBody: stream.body,
        });
      }
    }

    return stream.body;
  } catch {
    return stream.body || '[Error reading stream]';
  }
}
