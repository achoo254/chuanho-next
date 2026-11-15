/**
 * Getting a gentle sentence out of the app as plain text: the clipboard (with the old selection-copy fallback for
 * browsers without the async Clipboard API or outside a secure context) and the system share sheet when there is one.
 * Text only: no image, no link, nothing about the player.
 */

/** Copies `text`; false when neither the Clipboard API nor the fallback worked. */
export async function copyText(text: string): Promise<boolean> {
  if (typeof navigator.clipboard?.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.warn('Clipboard API refused, trying the fallback', error);
    }
  }
  return copyWithSelection(text);
}

function copyWithSelection(text: string): boolean {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.append(area);
  area.select();
  try {
    // Deprecated but still the only synchronous copy path on older mobile browsers.
    return document.execCommand('copy');
  } catch (error) {
    console.warn('Copy fallback failed', error);
    return false;
  } finally {
    area.remove();
  }
}

/** Whether the browser has a share sheet for plain text. */
export function canShareText(): boolean {
  return typeof navigator.share === 'function' && (typeof navigator.canShare !== 'function' || navigator.canShare({ text: 'x' }));
}

export type TextShareResult = 'shared' | 'cancelled' | 'failed';

/** Opens the share sheet with the text alone; closing the sheet is not an error. */
export async function shareText(text: string): Promise<TextShareResult> {
  try {
    await navigator.share({ text });
    return 'shared';
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    console.warn('Text share failed', error);
    return 'failed';
  }
}
