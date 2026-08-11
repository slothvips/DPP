import jsQR from 'jsqr';

/** 从 ImageData 解码二维码文本；失败返回 null */
export function decodeQrFromImageData(imageData: ImageData): string | null {
  const result = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: 'attemptBoth',
  });
  const text = result?.data?.trim();
  return text || null;
}

function decodeQrFromBitmap(bitmap: ImageBitmap, maxWidth: number): string | null {
  const scale = bitmap.width > maxWidth ? maxWidth / bitmap.width : 1;
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('无法创建画布上下文');
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  return decodeQrFromImageData(ctx.getImageData(0, 0, width, height));
}

/** 对位图做多尺度尝试，提升网页截图中小二维码的识别率 */
async function decodeQrFromBitmapMultiScale(bitmap: ImageBitmap): Promise<string | null> {
  const widths = [1600, 1200, 800, bitmap.width];
  const tried = new Set<number>();

  for (const maxWidth of widths) {
    const effective = Math.min(maxWidth, bitmap.width);
    if (tried.has(effective)) continue;
    tried.add(effective);

    const text = decodeQrFromBitmap(bitmap, effective);
    if (text) return text;
  }
  return null;
}

/** 从图片文件解码二维码文本 */
export async function decodeQrFromFile(file: File): Promise<string | null> {
  const bitmap = await createImageBitmap(file);
  try {
    return await decodeQrFromBitmapMultiScale(bitmap);
  } finally {
    bitmap.close();
  }
}

/** 从 data URL（如 tabs.captureVisibleTab）解码二维码文本 */
export async function decodeQrFromDataUrl(dataUrl: string): Promise<string | null> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);
  try {
    return await decodeQrFromBitmapMultiScale(bitmap);
  } finally {
    bitmap.close();
  }
}
