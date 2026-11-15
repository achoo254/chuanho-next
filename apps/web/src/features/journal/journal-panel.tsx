/**
 * "Check-in khẩu nghiệp": the karma journal screen. Quick check-in, the recent karma clouds (each can be released in
 * three real-world steps, see release-flow.tsx), the week as little plants, the "I held it back" counter, deleting one
 * entry or all, and an honest privacy line. Data: journal-store.ts (on this device; account sync merges into it).
 */
import { liveEntries } from '@chuanho/contract';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useGameSession } from '../../game/game-session-context';
import { PanelFrame } from '../panel-frame';
import type { PanelProps } from '../panel-registry';
import { JournalCheckInForm } from './journal-check-in-form';
import { JournalCloudList } from './journal-cloud-list';
import { JournalDeleteAll } from './journal-delete-all';
import { useJournalText } from './journal-messages';
import { useJournal } from './journal-store';
import { JournalWeekChart } from './journal-week-chart';
import { ReleaseFlow } from './release-flow';
import './journal.css';

/** How long the "+1" thanks shows before the count comes back. */
const THANKS_MS = 2000;

export function JournalPanel({ onBack, stage, registerStrike }: PanelProps): ReactNode {
  const text = useJournalText();
  const entries = useJournal();
  const live = useMemo(() => liveEntries(entries), [entries]);
  const [releasingId, setReleasingId] = useState<string | null>(null);
  const releasing = releasingId ? live.find((entry) => entry.id === releasingId) : undefined;

  if (releasing) {
    return <ReleaseFlow key={releasing.id} entry={releasing} stage={stage} registerStrike={registerStrike} onClose={() => setReleasingId(null)} />;
  }

  return (
    <PanelFrame title={text('title')} onBack={onBack} dataId="journal-panel" bar={<RestraintButton />}>
      <JournalCheckInForm />
      <JournalCloudList entries={live} onRelease={setReleasingId} />
      <JournalWeekChart entries={live} />
      <JournalDeleteAll hasEntries={live.length > 0} />
      <p className="panel-note journal-privacy" data-id="journal-privacy">
        {text('privacy')}
      </p>
    </PanelFrame>
  );
}

/** "Mình đã nhịn": one more held-back harsh word, counted only as a positive stat. */
function RestraintButton(): ReactNode {
  const text = useJournalText();
  const { restraintCount, recordRestraint } = useGameSession();
  const [thanked, setThanked] = useState(false);

  useEffect(() => {
    if (!thanked) return;
    const timer = window.setTimeout(() => setThanked(false), THANKS_MS);
    return () => window.clearTimeout(timer);
  }, [thanked, restraintCount]);

  return (
    <>
      <button
        type="button"
        className="play-chip journal-restraint"
        data-id="journal-restraint"
        onClick={() => {
          recordRestraint();
          setThanked(true);
        }}
      >
        {text('restraint.button')}
      </button>
      {(thanked || restraintCount > 0) && (
        <span className="play-chip" role="status" data-id="journal-restraint-count">
          {thanked ? text('restraint.thanks') : text('restraint.count', { n: restraintCount })}
        </span>
      )}
    </>
  );
}
