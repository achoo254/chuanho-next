/**
 * "Dịch sang tiếng hiền" (say it gently): the player picks what is bothering them and a tone, and gets a sentence
 * written ahead of time to send instead of the harsh one. The bank is a static file; nothing the player picks leaves
 * the device. This component only loads the bank and shows the loading or failure state around the chooser.
 */
import { type ReactNode, useEffect, useState } from 'react';
import { PanelFrame } from '../panel-frame';
import type { PanelProps } from '../panel-registry';
import { type GentleBank, loadGentleBank } from './gentle-bank';
import { GentleChooser } from './gentle-chooser';
import { useGentleText } from './gentle-messages';
import './gentle.css';

type BankState = { readonly status: 'loading' } | { readonly status: 'failed' } | { readonly status: 'ready'; readonly bank: GentleBank };

export function GentlePanel({ onBack }: PanelProps): ReactNode {
  const t = useGentleText();
  const [state, setState] = useState<BankState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    // loadGentleBank never rejects: a missing or broken file resolves to null.
    void loadGentleBank().then((bank) => {
      if (live) setState(bank ? { status: 'ready', bank } : { status: 'failed' });
    });
    return () => {
      live = false;
    };
  }, [attempt]);

  const retry = (): void => {
    setState({ status: 'loading' });
    setAttempt((count) => count + 1);
  };

  return (
    <PanelFrame title={t('title')} onBack={onBack} dataId="gentle-panel">
      <p className="panel-note">{t('intro')}</p>
      {state.status === 'loading' && (
        <p className="panel-line" role="status">
          {t('loading')}
        </p>
      )}
      {state.status === 'failed' && (
        <div className="gentle-step" role="alert">
          <p className="panel-line">{t('failed')}</p>
          <div className="gentle-actions">
            <button type="button" className="btn-secondary" onClick={retry} data-id="gentle-panel-retry">
              {t('retry')}
            </button>
          </div>
        </div>
      )}
      {state.status === 'ready' && <GentleChooser bank={state.bank} />}
      <p className="panel-note">{t('privacy')}</p>
    </PanelFrame>
  );
}
