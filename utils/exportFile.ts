/**
 * Platform-aware file export.
 *
 * - Web: classic blob download (works in desktop/mobile browsers).
 * - Native (Capacitor/APK): WebView <a download> does nothing, so we write the
 *   file to app cache via @capacitor/filesystem and open the Android share
 *   sheet via @capacitor/share — the user can save to Files, WhatsApp it,
 *   email it, etc.
 *
 * Returns how the file was delivered so the UI can phrase its toast.
 */
import { Capacitor } from '@capacitor/core';
import { log } from './log';

export type ExportOutcome = 'downloaded' | 'shared';

export async function exportFile(
  filename: string,
  mimeType: string,
  content: string
): Promise<ExportOutcome> {
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');

    const result = await Filesystem.writeFile({
      path: filename,
      data: content,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });

    try {
      await Share.share({
        title: filename,
        files: [result.uri],
        dialogTitle: 'Save or share your export',
      });
    } catch (e: any) {
      // User dismissed the share sheet — the file still exists in cache;
      // not an error worth surfacing.
      log.debug('Share dismissed:', e?.message);
    }
    return 'shared';
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}

/**
 * Binary image export (PNG as base64, no data: prefix).
 * Native: writes to cache and opens the share sheet — perfect for
 * WhatsApp-ing a Wrapped card. Web: classic download.
 */
export async function exportImage(
  filename: string,
  base64Data: string
): Promise<ExportOutcome> {
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');

    const result = await Filesystem.writeFile({
      path: filename,
      data: base64Data, // no encoding = binary from base64
      directory: Directory.Cache,
    });

    try {
      await Share.share({
        title: filename,
        files: [result.uri],
        dialogTitle: 'Share your Wrapped',
      });
    } catch (e: any) {
      log.debug('Share dismissed:', e?.message);
    }
    return 'shared';
  }

  const a = document.createElement('a');
  a.href = `data:image/png;base64,${base64Data}`;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  return 'downloaded';
}
