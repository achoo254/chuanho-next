import { describe, expect, it } from 'vitest';
import { LIGHTING_PRESET_IDS } from '../../scene/lighting-presets';
import { RADIO_CHOICES, RADIO_MODES, RADIO_MODE_IDS, resolveRadioMode, suggestedRadioMode } from './radio-modes';

describe('radio modes table', () => {
  it('keys every row by its own id and covers every mode id', () => {
    expect(Object.keys(RADIO_MODES).sort()).toEqual([...RADIO_MODE_IDS].sort());
    for (const id of RADIO_MODE_IDS) expect(RADIO_MODES[id].id).toBe(id);
    expect(RADIO_CHOICES).toEqual(['auto', ...RADIO_MODE_IDS]);
  });

  it('keeps every row inside its own rules', () => {
    for (const mode of Object.values(RADIO_MODES)) {
      expect(LIGHTING_PRESET_IDS).toContain(mode.lighting);
      expect(mode.gain).toBeGreaterThan(0);
      expect(mode.gain).toBeLessThanOrEqual(1);
      if (mode.sleepTimers.length > 0) expect(mode.sleepTimers).toContain(mode.defaultSleepTimer);
      else expect(mode.defaultSleepTimer).toBeNull();
      for (const minutes of mode.sleepTimers) if (minutes !== null) expect(minutes).toBeGreaterThan(0);
    }
  });

  it('sleeps under lantern light with a timer and works in the misty morning with the focus rhythm', () => {
    expect(RADIO_MODES.sleep).toMatchObject({ lighting: 'lanternNight', pomodoro: false, sleepTimers: [15, 30, 60, null] });
    expect(RADIO_MODES.work).toMatchObject({ lighting: 'mistyMorning', pomodoro: true, sleepTimers: [] });
    expect(RADIO_MODES.sleep.gain).toBeLessThan(RADIO_MODES.work.gain);
  });
});

describe('auto by the hour', () => {
  it('suggests sleep from 21:00 until before 5:00, work the rest of the day', () => {
    expect([21, 23, 0, 4].map(suggestedRadioMode)).toEqual(['sleep', 'sleep', 'sleep', 'sleep']);
    expect([5, 9, 13, 20].map(suggestedRadioMode)).toEqual(['work', 'work', 'work', 'work']);
  });

  it('lets an explicit choice win over the hour', () => {
    expect(resolveRadioMode('auto', 22).id).toBe('sleep');
    expect(resolveRadioMode('work', 22).id).toBe('work');
    expect(resolveRadioMode('sleep', 10).id).toBe('sleep');
  });
});
