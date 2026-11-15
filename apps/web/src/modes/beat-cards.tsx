/**
 * The two Mõ Beat cards: the level pick before a song (a lotus that opens wider for each harder level, all AI-drawn)
 * and the results inside the step-done card (PERFECT, GOOD and missed as tiles on the same art as the judgements,
 * then the best combo). A garland of lotuses and lanterns crowns both. Words are real text. When the music library
 * has playable songs, the level pick also offers the built-in lofi beat or a library song (nothing technical shown:
 * a library song's tempo is its own, so the levels then show no BPM).
 */
import type { ReactNode } from 'react';
import { DIFFICULTIES, DIFFICULTY_SPECS, type Difficulty } from '../game/beat-pattern';
import type { RhythmState } from '../game/rhythm-judge';
import { HudIcon } from '../hud/hud-icons';
import { useI18n } from '../i18n/i18n';
import { useBeatText } from './beat-messages';
import { usePlayText } from './play-mode-messages';
import './beat-cards.css';

export type BeatSongSource = 'builtIn' | 'library';
const SOURCES: readonly BeatSongSource[] = ['builtIn', 'library'];

export interface BeatLevelCardProps {
  readonly difficulty: Difficulty;
  readonly onPick: (level: Difficulty) => void;
  readonly onStart: () => void;
  /** The song choice, offered only when a library song is ready (null hides it). */
  readonly source: BeatSongSource | null;
  readonly onSource: (source: BeatSongSource) => void;
  /** A library song is loading after the start: the start button waits. */
  readonly loading: boolean;
}

const LEVEL_LABELS = { easy: 'beat.easy', normal: 'beat.normal', hard: 'beat.hard' } as const;
const LEVEL_ART: Readonly<Record<Difficulty, string>> = {
  easy: '/art/beat/level-easy.webp',
  normal: '/art/beat/level-normal.webp',
  hard: '/art/beat/level-hard.webp',
};
const GARLAND = '/art/beat/garland.webp';

function Garland(): ReactNode {
  return <img className="beat-garland" src={GARLAND} alt="" draggable={false} />;
}

export function BeatLevelCard({ difficulty, onPick, onStart, source, onSource, loading }: BeatLevelCardProps): ReactNode {
  const { t } = useI18n();
  const text = usePlayText();
  const beatText = useBeatText();
  return (
    <div className="play-card beat-card" data-id="beat-levels">
      <Garland />
      {source !== null && (
        <div className="beat-sources" role="radiogroup" aria-label={beatText('source')}>
          {SOURCES.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={option === source}
              className="beat-level beat-source"
              data-id={`beat-source-${option}`}
              onClick={() => onSource(option)}
            >
              <span className="beat-level-name">{beatText(option)}</span>
            </button>
          ))}
        </div>
      )}
      <p className="beat-card-title">{t('beat.choose')}</p>
      <div className="beat-levels" role="radiogroup" aria-label={text('chooseLevel')}>
        {DIFFICULTIES.map((level) => (
          <button
            key={level}
            type="button"
            role="radio"
            aria-checked={level === difficulty}
            className="beat-level"
            data-id={`beat-level-${level}`}
            onClick={() => onPick(level)}
          >
            <img className="beat-level-art" src={LEVEL_ART[level]} alt="" draggable={false} />
            <span className="beat-level-name">{t(LEVEL_LABELS[level])}</span>
            {source !== 'library' && <small className="beat-level-bpm">{t('beat.bpm', { bpm: DIFFICULTY_SPECS[level].bpm })}</small>}
          </button>
        ))}
      </div>
      <p className="beat-card-note">{t('beat.howTo')}</p>
      <button
        type="button"
        className="btn-primary beat-start"
        aria-label={loading ? beatText('loading') : text('start')}
        aria-busy={loading}
        disabled={loading}
        data-id="beat-start"
        onClick={onStart}
      >
        <HudIcon name="mo" size={22} />
        {loading ? beatText('loading') : t('beat.title')}
      </button>
    </div>
  );
}

const RESULT_TILES = [
  { grade: 'perfect', art: '/art/beat/judge-perfect.webp', label: 'beat.perfect' },
  { grade: 'good', art: '/art/beat/judge-good.webp', label: 'beat.good' },
  { grade: 'miss', art: '/art/beat/judge-miss.webp', label: 'beat.miss' },
] as const;

/** The song's tally, placed inside the step-done card (the garland is moved to the card's top by CSS). */
export function BeatResults({ state, onAgain }: { state: RhythmState; onAgain: () => void }): ReactNode {
  const { t } = useI18n();
  const counts = { perfect: state.perfects, good: state.goods, miss: state.misses };
  return (
    <>
      <Garland />
      <div className="beat-results" role="list" aria-label={t('beat.resultLine', counts)}>
        {RESULT_TILES.map((tile) => (
          <div key={tile.grade} role="listitem" className={`beat-tile beat-tile-${tile.grade}`} data-id={`beat-result-${tile.grade}`}>
            <img className="beat-tile-art" src={tile.art} alt="" draggable={false} />
            <b className="beat-tile-n">{counts[tile.grade]}</b>
            <span className="beat-tile-label">{t(tile.label)}</span>
          </div>
        ))}
      </div>
      <p className="beat-best">
        <img className="beat-best-art" src="/art/beat/combo-badge.webp" alt="" draggable={false} />
        {t('beat.bestCombo', { n: state.bestCombo })}
      </p>
      <p className="beat-card-note">{t('beat.private')}</p>
      <button type="button" className="btn-secondary" data-id="beat-again" onClick={onAgain}>
        {t('beat.again')}
      </button>
    </>
  );
}
