/**
 * The account control in the HUD's top bar. A guest (or anyone while the check is pending, or with no server) gets a
 * one-tap sign-in link to the server's /auth/login, never a wall; a signed-in player gets a round chip with the first
 * letter of their name, which opens the account menu.
 */
import { type ReactNode, useState } from 'react';
import { HudIcon } from '../hud/hud-icons';
import { useHudText } from '../hud/hud-messages';
import { useI18n } from '../i18n/i18n';
import { signInHref } from './account-api';
import { useAccount } from './account-context';
import { useAccountText } from './account-messages';
import { nameInitial } from './account-state';
import { AccountDialog } from './account-dialog';

export function AccountButton(): ReactNode {
  const { locale } = useI18n();
  const hudText = useHudText();
  const text = useAccountText();
  const { user } = useAccount();
  const [open, setOpen] = useState(false);

  const control = user ? (
    <button
      type="button"
      className="hud-btn account-chip"
      aria-label={hudText('account', { name: user.name || text('you') })}
      aria-haspopup="dialog"
      data-tip={hudText('account', { name: user.name || text('you') })}
      data-id="game3d-account"
      onClick={() => setOpen(true)}
    >
      {nameInitial(user.name) ?? <HudIcon name="account" />}
    </button>
  ) : (
    <a
      className="hud-btn"
      href={signInHref(`${window.location.pathname}${window.location.search}`, locale)}
      aria-label={hudText('signIn')}
      data-tip={hudText('signIn')}
      data-id="game3d-sign-in"
    >
      <HudIcon name="signIn" />
    </a>
  );

  return (
    <>
      {control}
      {/* Stays mounted while open, so the result of "delete, then sign out" is still shown after signing out. */}
      {open && <AccountDialog open={open} onClose={() => setOpen(false)} />}
    </>
  );
}
