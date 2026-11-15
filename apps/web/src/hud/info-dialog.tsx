/**
 * The "i" panel: what the app is and its five promises. The promises left the play screen to give the game room;
 * they live here and in the README, unchanged. A native modal dialog, so Esc, focus trapping and the backdrop come
 * from the browser.
 */
import { type ReactNode, useEffect, useRef } from 'react';
import { useI18n } from '../i18n/i18n';
import { PledgeList } from '../ui/pledge-list';
import { HudIcon } from './hud-icons';
import { useHudText } from './hud-messages';

export function InfoDialog({ open, onClose }: { open: boolean; onClose: () => void }): ReactNode {
  const { t } = useI18n();
  const text = useHudText();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} className="game3d-dialog" aria-label={text('info')} data-id="game3d-info" onClose={onClose}>
      <button type="button" className="hud-btn game3d-dialog-close" aria-label={text('close')} data-id="game3d-info-close" onClick={onClose}>
        <HudIcon name="close" />
      </button>
      <p className="game3d-dialog-text">{t('yard.aboutText')}</p>
      <PledgeList dataId="game3d-pledges" />
      <p className="game3d-dialog-note">{t('layout.disclaimer')}</p>
    </dialog>
  );
}
