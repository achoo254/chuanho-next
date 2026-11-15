/**
 * The one question asked after signing in when the data on this device is not the account's yet (see
 * sync/ownership-decision.ts): a guest's data is added to the account only if the player says so ("merge" or start
 * empty), and another account's data can only be cleared ("start clean"), never added. Sync waits for the answer.
 *
 * Closing the dialog (Esc, the close button) answers nothing: sync stays paused and the question comes back on the next
 * visit. A native modal dialog like the account menu, so Esc, focus trapping and the backdrop come from the browser.
 */
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { HudIcon } from '../hud/hud-icons';
import { useHudText } from '../hud/hud-messages';
import type { OwnershipQuestion } from '../sync/ownership-decision';
import { useOwnershipQuestion } from '../sync/sync-provider';
import { useAccountText } from './account-messages';

export function AccountOwnershipDialog(): ReactNode {
  const hudText = useHudText();
  const text = useAccountText();
  const { question, answer } = useOwnershipQuestion();
  const [dismissed, setDismissed] = useState<OwnershipQuestion | null>(null);
  const ref = useRef<HTMLDialogElement>(null);
  const open = question !== null && question !== dismissed;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const close = (): void => setDismissed(question);

  return (
    <dialog ref={ref} className="game3d-dialog account-dialog" aria-labelledby="account-ownership-question" data-id="account-ownership" onClose={close}>
      <button type="button" className="hud-btn game3d-dialog-close" aria-label={hudText('close')} data-id="account-ownership-close" onClick={close}>
        <HudIcon name="close" />
      </button>
      {question === 'merge' && (
        <div className="account-confirm">
          <p className="account-question" id="account-ownership-question">
            {text('mergeAsk')}
          </p>
          <p className="account-hint">{text('mergeNote')}</p>
          <button type="button" className="btn-secondary" data-id="account-ownership-merge" onClick={() => answer('merge')}>
            {text('merge')}
          </button>
          <button type="button" className="btn-secondary" data-id="account-ownership-no-merge" onClick={() => answer('startClean')}>
            {text('noMerge')}
          </button>
          <p className="account-hint">{text('noMergeNote')}</p>
        </div>
      )}
      {question === 'startClean' && (
        <div className="account-confirm">
          <p className="account-question" id="account-ownership-question">
            {text('otherOwnerAsk')}
          </p>
          <button type="button" className="btn-secondary account-danger" data-id="account-ownership-start-clean" onClick={() => answer('startClean')}>
            {text('startClean')}
          </button>
          <p className="account-hint">{text('startCleanNote')}</p>
        </div>
      )}
    </dialog>
  );
}
