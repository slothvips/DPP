import { isStreamingContentType, safeReadResponseBody, streamResponseBody } from './stream';
import type { NetworkRequestData } from './types';
import { emitNetworkEvent, headersToObject, processHeaders } from './utils';

export async function populateFetchResponseData(
  response: Response,
  networkData: NetworkRequestData
): Promise<void> {
  networkData.status = response.status;
  networkData.statusText = response.statusText;
  networkData.responseHeaders = processHeaders(headersToObject(response.headers));

  const contentType = response.headers.get('content-type') || '';
  networkData.responseType = contentType;
  networkData.phase = 'response-headers';
  emitNetworkEvent({ ...networkData });

  if (isStreamingContentType(contentType) && response.body) {
    networkData.isStreaming = true;
    networkData.responseBody = await streamResponseBody(response, networkData, contentType);
  } else {
    networkData.responseBody = await safeReadResponseBody(response, contentType);
  }

  networkData.endTime = Date.now();
  networkData.duration = networkData.endTime - networkData.startTime;
  networkData.phase = 'complete';
}

export function populateFetchErrorData(networkData: NetworkRequestData, error: unknown) {
  networkData.endTime = Date.now();
  networkData.duration = networkData.endTime - networkData.startTime;
  networkData.error = error instanceof Error ? error.message : String(error);
  networkData.phase = 'error';
}
