/**
 * The account menu: who is signed in, where sync stands, delete everything on the server (two steps: ask, then pick
 * "only on the server" or "also on this device"), and sign out. A native modal dialog like the "i" panel, so Esc,
 * focus trapping and the backdrop come from the browser; the shell's keys ignore everything inside a dialog.
 *
 * "Only on the server" signs out afterwards: the device keeps its data as a guest's, and staying signed in would just
 * upload it all again at the next sync; signing in again asks before adding it to the account.
 *
 * Signing out keeps the data on the device, still marked as this account's (another account signing in here is never
 * handed it); "clear the data on this device" wipes it instead.
 */
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { HudIcon } from '../hud/hud-icons';
import { useHudText } from '../hud/hud-messages';
import { useI18n } from '../i18n/i18n';
import { useSyncControls, useSyncStatus } from '../sync/sync-provider';
import { useAccount } from './account-context';
import { useAccountText } from './account-messages';
import { syncStatusLine } from './sync-status-line';

type Step = 'idle' | 'asking' | 'busy' | 'deleted' | 'failed' | 'signingOut' | 'signOutFailed';

export function AccountDialog({ open, onClose }: { open: boolean; onClose: () => void }): ReactNode {
  const { locale } = useI18n();
  const hudText = useHudText();
  const text = useAccountText();
  const { user, api, signOut } = useAccount();
  const sync = useSyncStatus();
  const { wipeLocalAndRestart, wipeLocalAndForget, releaseToGuest } = useSyncControls();
  const [step, setStep] = useState<Step>('idle');
  const [wipeOnSignOut, setWipeOnSignOut] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // A stray Enter on the question keeps the data.
  useEffect(() => {
    if (step === 'asking') keepRef.current?.focus();
  }, [step]);

  const close = (): void => {
    setStep('idle');
    onClose();
  };

  const deleteData = async (alsoHere: boolean): Promise<void> => {
    setStep('busy');
    const result = await api.deleteAllData();
    if (!result.ok) {
      setStep('failed');
      return;
    }
    if (alsoHere) wipeLocalAndRestart();
    else {
      // Released before signing out: no sync in between can mark the data as this account's again.
      releaseToGuest();
      await signOut();
    }
    setStep('deleted');
  };

  const leave = async (): Promise<void> => {
    setStep('signingOut');
    if (!(await signOut())) {
      setStep('signOutFailed');
      return;
    }
    if (wipeOnSignOut) wipeLocalAndForget();
    close();
  };

  const line = syncStatusLine(sync, locale);
  const notice = step === 'deleted' ? text('deleted') : step === 'failed' ? text('deleteFailed') : step === 'signOutFailed' ? text('signOutFailed') : null;

  return (
    <dialog ref={ref} className="game3d-dialog account-dialog" aria-labelledby="account-dialog-name" data-id="account-dialog" onClose={close}>
      <button type="button" className="hud-btn game3d-dialog-close" aria-label={hudText('close')} data-id="account-dialog-close" onClick={close}>
        <HudIcon name="close" />
      </button>
      <p className="account-name" id="account-dialog-name">
        <HudIcon name="account" size={20} />
        <span>{user ? user.name || text('you') : text('you')}</span>
      </p>
      {user && (
        <p className="account-line" role="status" data-id="account-sync-status">
          {text(line.key, line.vars)}
        </p>
      )}
      {user && sync.full.includes('journal') && <p className="account-line">{text('journalFull')}</p>}
      {notice && (
        <p className="account-line account-notice" role="status" data-id="account-notice">
          {notice}
        </p>
      )}
      {user && step === 'asking' && (
        <div className="account-confirm" role="alertdialog" aria-labelledby="account-delete-question" data-id="account-delete-confirm">
          <p className="account-question" id="account-delete-question">
            {text('deleteAsk')}
          </p>
          <button ref={keepRef} type="button" className="btn-secondary" data-id="account-delete-keep" onClick={() => setStep('idle')}>
            {text('keep')}
          </button>
          <button type="button" className="btn-secondary account-danger" data-id="account-delete-server" onClick={() => void deleteData(false)}>
            {text('deleteServerOnly')}
          </button>
          <p className="account-hint">{text('deleteServerOnlyNote')}</p>
          <button type="button" className="btn-secondary account-danger" data-id="account-delete-everywhere" onClick={() => void deleteData(true)}>
            {text('deleteEverywhere')}
          </button>
        </div>
      )}
      {user && step !== 'asking' && (
        <div className="account-actions">
          <button type="button" className="btn-chip" disabled={step === 'busy' || step === 'signingOut'} data-id="account-delete-start" onClick={() => setStep('asking')}>
            <HudIcon name="trash" size={16} />
            <span>{step === 'busy' ? text('deleting') : text('deleteStart')}</span>
          </button>
          <button type="button" className="btn-secondary" disabled={step === 'busy' || step === 'signingOut'} data-id="account-sign-out" onClick={() => void leave()}>
            <HudIcon name="signOut" size={18} />
            <span>{step === 'signingOut' ? text('signingOut') : text('signOut')}</span>
          </button>
          <label className="account-hint account-check" data-id="account-sign-out-wipe">
            <input type="checkbox" checked={wipeOnSignOut} disabled={step === 'signingOut'} onChange={(event) => setWipeOnSignOut(event.target.checked)} />
            <span>{text('signOutWipe')}</span>
          </label>
        </div>
      )}
    </dialog>
  );
}
