/**
 * Posts a picture through the Web Share API with the image file where the browser supports it, and downloads it
 * otherwise (or when sharing fails). Closing the share sheet is not an error and downloads nothing.
 */
import { downloadBlob } from './draw-share-card';

export type ShareResult = 'shared' | 'cancelled' | 'downloaded';

export async function shareImageFile(blob: Blob, fileName: string): Promise<ShareResult> {
  const file = new File([blob], fileName, { type: blob.type || 'image/png' });
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      console.warn('Share failed, downloading instead', error);
    }
  }
  downloadBlob(blob, fileName);
  return 'downloaded';
}
