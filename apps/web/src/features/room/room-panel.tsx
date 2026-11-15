/**
 * "Phòng giải nghiệp": the shared incense room. Checks the session first (signed out: one Sign in link that comes
 * back here, the yard stays playable), then the lobby or the room. An invite (`?room=CODE`) is read once and taken
 * off the address; it opens a preview with the code and a "join" button, never the room itself, so the player's
 * display name reaches the room only after they tap.
 *
 * The invite and the room belong to this panel and to the account that opened them: nothing is kept at module level,
 * and signing out or switching accounts drops both, so another account on the same page never inherits a room code.
 *
 * The panel also owns the room's 3D moments: the entry cutscene before the card shows (room-intro-cutscene.tsx), the
 * censer's sticks linked to the player's own stick (use-room-incense.ts), and the "Hộ hương" minigame over the yard
 * (room-game-overlay.tsx), seeded by the day and the room code. `?play=room-game` previews the minigame as practice.
 */
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useAccount } from '../../account/account-context';
import { localDateKey } from '../../game/session-day';
import { playDemoParams } from '../../modes/play-demo-params';
import { PanelFrame } from '../panel-frame';
import type { PanelProps } from '../panel-registry';
import { type RoomApiError, roomApi } from './room-api';
import { takeInviteCode } from './room-invite';
import { RoomDemoSection } from './room-demo-section';
import { RoomGameOverlay } from './room-game-overlay';
import { gustSeed } from './gust-schedule';
import { type MyStickSource, OUTSIDE_ROOM, myStickStatus } from './room-incense-timeline';
import { RoomIntroCutscene, useRoomIntro } from './room-intro-cutscene';
import { RoomLightUpCue } from './room-light-up-cue';
import { type Gate, RoomGateView } from './room-gate-view';
import { useRoomText } from './room-messages';
import { errorKey } from './room-view-model';
import { useRoomIncense } from './use-room-incense';
import './room.css';

const api = roomApi();
/** The room code the preview seeds its wind with. */
const PREVIEW_CODE = 'PREVIEW';

interface GameRound {
  readonly seed: number;
  readonly practice: boolean;
}

const roundFor = (code: string, practice: boolean): GameRound => ({ seed: gustSeed(localDateKey(new Date()), code), practice });

export function RoomPanel({ stage, onBack, registerStrike }: PanelProps): ReactNode {
  const t = useRoomText();
  const [preview] = useState(() => playDemoParams(window.location.search).roomGame);
  const intro = useRoomIntro(stage);
  const [stick, setStick] = useState<MyStickSource>(OUTSIDE_ROOM);
  // The preview opens its round right after the cutscene, once; a real room opens it from the room view.
  const [game, setGame] = useState<GameRound | null>(() => (preview ? roundFor(PREVIEW_CODE, true) : null));
  const shownGame = intro.running ? null : game;
  const incense = useRoomIncense(stage, stick, !intro.running && game === null);
  const closeGame = useCallback(() => setGame(null), []);
  const accountId = useAccount().user?.id ?? null;
  const [gate, setGate] = useState<Gate>({ kind: 'checking' });
  const [attempt, setAttempt] = useState(0);
  // The invite of this opening, kept across a retry (the address no longer has it).
  const invite = useRef<string | null>(null);
  const seenAccount = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    // Signing out or switching accounts drops the invite; the account finishing loading (null → id) does not.
    if (seenAccount.current !== null && seenAccount.current !== accountId) invite.current = null;
    seenAccount.current = accountId;
    invite.current = takeInviteCode() ?? invite.current;
    void api.me().then((result) => {
      if (!active) return;
      const code = invite.current;
      if (result.ok) setGate(code ? { kind: 'invite', code, accountId } : { kind: 'lobby', notice: '' });
      else setGate(result.error.kind === 'signed-out' ? { kind: 'signed-out', invite: code } : { kind: 'offline' });
    });
    return () => {
      active = false;
    };
  }, [attempt, accountId]);

  const enter = useCallback(
    (code: string) => {
      invite.current = null;
      setGate({ kind: 'room', code, accountId });
    },
    [accountId],
  );

  const exit = useCallback(
    (error: RoomApiError | null) => {
      if (error?.kind === 'signed-out') setGate({ kind: 'signed-out', invite: null });
      else setGate({ kind: 'lobby', notice: error ? t(errorKey(error)) : '' });
    },
    [t],
  );

  const skipInvite = useCallback(() => {
    invite.current = null;
    setGate({ kind: 'lobby', notice: '' });
  }, []);

  const playIn = (code: string): void => setGame(roundFor(code, myStickStatus(stick, Date.now()).kind !== 'burning'));

  const retry = (): void => {
    setGate({ kind: 'checking' });
    setAttempt((count) => count + 1);
  };

  // A room or invite opened by another account (the session changed under the panel) is not shown while the check
  // for the new one runs.
  const stale = (gate.kind === 'room' || gate.kind === 'invite') && gate.accountId !== accountId;
  const shown: Gate = stale ? { kind: 'checking' } : gate;

  return (
    <>
      {intro.running && <RoomIntroCutscene intro={intro} registerStrike={registerStrike} />}
      {incense.lightingUp && <RoomLightUpCue />}
      {/* The card waits behind the cutscenes and the minigame; the room inside it stays connected. */}
      <div className="room-frame" hidden={intro.running || incense.lightingUp || shownGame !== null}>
        <PanelFrame title={t('title')} onBack={onBack} dataId="room-panel">
          {preview ? (
            <RoomDemoSection onPlay={() => setGame(roundFor(PREVIEW_CODE, true))} onLight={incense.celebrateLight} />
          ) : (
            <RoomGateView gate={shown} api={api} retry={retry} enter={enter} exit={exit} skipInvite={skipInvite} onStick={setStick} onLit={incense.celebrateLight} onPlay={playIn} />
          )}
          <p className="panel-note">{t('privacy')}</p>
        </PanelFrame>
      </div>
      {shownGame && <RoomGameOverlay stage={stage} seed={shownGame.seed} practice={shownGame.practice} baseBurn={incense.baseBurn} onClose={closeGame} />}
    </>
  );
}
