const MATERIAL_DEEP_LINK_HOST = 'localhost';
const MATERIAL_DEEP_LINK_PATH = '/dpp/material/';
const LEGACY_MATERIAL_DEEP_LINK_HOST = 'dpp.invalid';
const LEGACY_MATERIAL_DEEP_LINK_PATH = '/material/';

export function createConversationMaterialDeepLink(materialId: string): string {
  const normalizedId = normalizeMaterialId(materialId);
  return `http://${MATERIAL_DEEP_LINK_HOST}${MATERIAL_DEEP_LINK_PATH}${encodeURIComponent(normalizedId)}`;
}

export function parseConversationMaterialDeepLink(value: string): string | undefined {
  try {
    const url = new URL(value);
    const isCurrentLink =
      url.protocol === 'http:' &&
      url.hostname === MATERIAL_DEEP_LINK_HOST &&
      url.pathname.startsWith(MATERIAL_DEEP_LINK_PATH);
    const isLegacyLink =
      url.protocol === 'https:' &&
      url.hostname === LEGACY_MATERIAL_DEEP_LINK_HOST &&
      url.pathname.startsWith(LEGACY_MATERIAL_DEEP_LINK_PATH);
    if (url.port || url.search || url.hash || (!isCurrentLink && !isLegacyLink)) {
      return undefined;
    }

    const path = isCurrentLink ? MATERIAL_DEEP_LINK_PATH : LEGACY_MATERIAL_DEEP_LINK_PATH;
    const encodedId = url.pathname.slice(path.length);
    if (!encodedId || encodedId.includes('/')) return undefined;
    return normalizeMaterialId(decodeURIComponent(encodedId));
  } catch {
    return undefined;
  }
}

function normalizeMaterialId(value: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > 200 || normalized.includes('/')) {
    throw new Error('物料 ID 无效');
  }
  return normalized;
}
