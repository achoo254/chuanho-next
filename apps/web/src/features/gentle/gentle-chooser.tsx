/**
 * The three picks of the "say it gently" screen (group, situation, tone) and the suggestion they lead to. Which
 * sentence shows is decided by the pure helpers in gentle-logic.ts; this component only keeps the picks.
 */
import { type ReactNode, useMemo, useState } from 'react';
import { GENTLE_TONES, type GentleBank, type GentleGroup, type GentleTone } from './gentle-bank';
import { findSituation, firstVariant, groupSituations, nextVariant } from './gentle-logic';
import { useGentleText } from './gentle-messages';
import { GentleResultCard } from './gentle-result-card';

interface ChipOption<T extends string> {
  readonly id: T;
  readonly label: string;
}

interface GentleChipsProps<T extends string> {
  readonly step: string;
  readonly label: string;
  readonly options: readonly ChipOption<T>[];
  readonly selected: T | null;
  readonly onSelect: (id: T) => void;
}

/** One labelled row of pressable chips. */
function GentleChips<T extends string>({ step, label, options, selected, onSelect }: GentleChipsProps<T>): ReactNode {
  return (
    <div className="gentle-step">
      <p className="gentle-step-label" id={`gentle-${step}-label`}>
        {label}
      </p>
      <div className="panel-choices" role="group" aria-labelledby={`gentle-${step}-label`}>
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            className="panel-choice"
            aria-pressed={option.id === selected}
            onClick={() => onSelect(option.id)}
            data-id={`gentle-${step}-${option.id}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** A fresh varying start for a new pick, so the same sentence does not always lead. */
const randomSeed = (): number => Math.floor(Math.random() * 1_000_000);

export function GentleChooser({ bank }: { readonly bank: GentleBank }): ReactNode {
  const t = useGentleText();
  const groups = useMemo(() => groupSituations(bank), [bank]);
  const [group, setGroup] = useState<GentleGroup | null>(groups[0]?.group ?? null);
  const [situationId, setSituationId] = useState<string | null>(null);
  const [tone, setTone] = useState<GentleTone>('soft');
  const [variant, setVariant] = useState(0);

  const situation = findSituation(bank, situationId);
  const sentences = situation ? situation.tones[tone] : [];
  const sentence = sentences[variant] ?? sentences[0];
  const situationsInGroup = groups.find((entry) => entry.group === group)?.situations ?? [];

  const pickGroup = (next: GentleGroup): void => {
    setGroup(next);
    if (situation?.group !== next) setSituationId(null);
  };
  const pickSituation = (id: string): void => {
    setSituationId(id);
    setVariant(firstVariant(findSituation(bank, id)?.tones[tone].length ?? 0, randomSeed()));
  };
  const pickTone = (next: GentleTone): void => {
    setTone(next);
    setVariant(firstVariant(situation?.tones[next].length ?? 0, randomSeed()));
  };

  return (
    <>
      <GentleChips
        step="group"
        label={t('step.group')}
        options={groups.map((entry) => ({ id: entry.group, label: t(`group.${entry.group}`) }))}
        selected={group}
        onSelect={pickGroup}
      />
      <GentleChips
        step="situation"
        label={t('step.situation')}
        options={situationsInGroup.map((entry) => ({ id: entry.id, label: entry.label }))}
        selected={situationId}
        onSelect={pickSituation}
      />
      <GentleChips step="tone" label={t('step.tone')} options={GENTLE_TONES.map((id) => ({ id, label: t(`tone.${id}`) }))} selected={tone} onSelect={pickTone} />
      {sentence === undefined ? (
        <p className="panel-note">{t('pickSituation')}</p>
      ) : (
        <GentleResultCard
          key={`${situationId ?? ''}:${tone}`}
          sentence={sentence}
          index={Math.min(variant, sentences.length - 1)}
          total={sentences.length}
          onAnother={() => setVariant((current) => nextVariant(sentences.length, current))}
        />
      )}
    </>
  );
}
