import type { JenkinsArtifactDownload } from '@/features/jenkins/messages';
import { http } from '@/lib/http';
import { createJenkinsClient } from './client';
import { JenkinsApiError, createJenkinsHttpError, createJenkinsNetworkError } from './contracts';
import { assertJenkinsRedirectAllowed, createJenkinsArtifactUrl } from './urlSafety';

const MAX_ARTIFACT_BYTES = 10 * 1024 * 1024;

function bytesToBase64(bytes: Uint8Array): string {
  const parts: string[] = [];
  for (let start = 0; start < bytes.length; start += 32_768) {
    parts.push(String.fromCharCode(...bytes.subarray(start, start + 32_768)));
  }
  return btoa(parts.join(''));
}

export async function downloadArtifact(
  buildUrl: string,
  relativePath: string,
  user: string,
  token: string,
  jenkinsHost: string
): Promise<JenkinsArtifactDownload> {
  const client = createJenkinsClient({ baseUrl: jenkinsHost, user, token });
  const artifactUrl = createJenkinsArtifactUrl(buildUrl, relativePath, client.rootUrl);
  let response: Response;
  try {
    response = await http(artifactUrl, {
      headers: client.headers,
      credentials: 'include',
      redirect: 'manual',
      timeout: 60_000,
    });
  } catch (error) {
    throw createJenkinsNetworkError(error);
  }

  assertJenkinsRedirectAllowed(response, artifactUrl, client.rootUrl);
  if (response.status >= 300 && response.status < 400) {
    throw new JenkinsApiError('invalid_response', 'Jenkins 产物发生重定向，请在 Jenkins 页面下载');
  }
  if (!response.ok) throw createJenkinsHttpError(response, await response.text());

  const contentLength = Number.parseInt(response.headers.get('Content-Length') || '', 10);
  if (Number.isSafeInteger(contentLength) && contentLength > MAX_ARTIFACT_BYTES) {
    throw new JenkinsApiError('invalid_response', 'Jenkins 产物超过 10 MiB 下载限制');
  }
  if (!response.body) {
    throw new JenkinsApiError('invalid_response', 'Jenkins 产物响应没有内容');
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_ARTIFACT_BYTES) {
      await reader.cancel();
      throw new JenkinsApiError('invalid_response', 'Jenkins 产物超过 10 MiB 下载限制');
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return {
    base64: bytesToBase64(bytes),
    contentType: response.headers.get('Content-Type') || 'application/octet-stream',
    size,
  };
}
