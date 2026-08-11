import { ImageUp, Loader2, ScanQrCode } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { logger } from '@/utils/logger';
import { decodeQrFromDataUrl, decodeQrFromFile } from '../qrDecode';

interface TotpQrScanPanelProps {
  onDetected: (text: string) => void;
}

type CaptureVisibleTabResponse =
  | { success: true; dataUrl: string }
  | { success: false; error: string };

export function TotpQrScanPanel({ onDetected }: TotpQrScanPanelProps) {
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleScanPage() {
    setScanError(null);
    setScanning(true);

    try {
      const response = (await browser.runtime.sendMessage({
        type: 'CAPTURE_VISIBLE_TAB',
      })) as CaptureVisibleTabResponse;

      if (!response?.success) {
        setScanError(response?.error || '截取网页失败，请确认当前窗口有可访问的标签页');
        return;
      }

      const text = await decodeQrFromDataUrl(response.dataUrl);
      if (!text) {
        setScanError('当前网页可见区域未识别到二维码，请把二维码完整露出后再试，或改用图片识别');
        return;
      }

      onDetected(text);
    } catch (error) {
      logger.warn('Failed to scan page QR', error);
      setScanError('扫描网页失败，请重试');
    } finally {
      setScanning(false);
    }
  }

  async function handleFileChange(file: File | undefined) {
    if (!file) return;
    setScanError(null);
    setScanning(true);

    try {
      const text = await decodeQrFromFile(file);
      if (!text) {
        setScanError('未能识别图片中的二维码，请换一张更清晰的截图');
        return;
      }
      onDetected(text);
    } catch (error) {
      logger.warn('Failed to decode QR image', error);
      setScanError('读取图片失败，请重试');
    } finally {
      setScanning(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  return (
    <div className="grid gap-2" data-testid="totp-qr-scan-panel">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1 rounded-lg px-2.5 text-xs"
          disabled={scanning}
          onClick={() => void handleScanPage()}
          data-testid="totp-qr-scan-button"
        >
          {scanning ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ScanQrCode className="h-3.5 w-3.5" />
          )}
          {scanning ? '识别中…' : '扫描网页二维码'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1 rounded-lg px-2.5 text-xs text-muted-foreground"
          disabled={scanning}
          onClick={() => fileInputRef.current?.click()}
          data-testid="totp-qr-file-button"
        >
          <ImageUp className="h-3.5 w-3.5" />
          从图片识别
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          data-testid="totp-qr-file-input"
          onChange={(event) => void handleFileChange(event.target.files?.[0])}
        />
      </div>

      <p className="text-xs leading-5 text-muted-foreground">
        会截取当前浏览器窗口中可见标签页画面并识别二维码；请先把含 otpauth://
        的二维码完整露在页面内。
      </p>
      {scanError ? <p className="text-xs text-destructive">{scanError}</p> : null}
    </div>
  );
}
