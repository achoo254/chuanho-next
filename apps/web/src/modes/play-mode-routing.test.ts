import { describe, expect, it } from 'vitest';
import { PROP_ACTIONS } from '../scene/world-actions';
import { modeForAction, nextSessionStep, routeActions } from './play-mode-routing';

describe('routeActions', () => {
  it('opens the matching mode from the censer and the sutra stand', () => {
    expect(routeActions(PROP_ACTIONS.censer)).toEqual({ kind: 'enter', mode: 'incense' });
    expect(routeActions(PROP_ACTIONS.sutraShelf)).toEqual({ kind: 'enter', mode: 'sutra' });
  });

  it('asks which drumming mode when the wooden fish is picked', () => {
    expect(routeActions(PROP_ACTIONS.mo)).toEqual({ kind: 'choose', actions: ['beat', 'endless'] });
  });

  it('only sounds the bell and the bowl', () => {
    expect(routeActions(PROP_ACTIONS.bell)).toEqual({ kind: 'sound', sample: 'bell' });
    expect(routeActions(PROP_ACTIONS.bowl)).toEqual({ kind: 'sound', sample: 'bowl' });
  });

  it('offers the journal, the gentle-words tool and the radio from the board', () => {
    expect(routeActions(PROP_ACTIONS.woodenBoard)).toEqual({ kind: 'choose', actions: ['journal', 'gentle', 'radio'] });
  });

  it('keeps what needs the server as coming soon', () => {
    expect(routeActions(['fortune'])).toEqual({ kind: 'soon', actions: ['fortune'] });
    expect(routeActions(['room'])).toEqual({ kind: 'enter', mode: 'room' });
  });

  it('opens a single shortcut action directly and strikes on Space', () => {
    expect(routeActions(['beat'])).toEqual({ kind: 'enter', mode: 'beat' });
    expect(routeActions(['endless'])).toEqual({ kind: 'enter', mode: 'endless' });
    expect(routeActions(['strike'])).toEqual({ kind: 'strike' });
    expect(routeActions([])).toEqual({ kind: 'none' });
  });
});

describe('modeForAction', () => {
  it('maps the playable actions only', () => {
    expect(modeForAction('incense')).toBe('incense');
    expect(modeForAction('bell')).toBeNull();
    expect(modeForAction('radio')).toBe('radio');
  });
});

describe('nextSessionStep', () => {
  it('walks the session in order, skipping what is done', () => {
    expect(nextSessionStep({ incense: false, beat: false, sutra: false })).toBe('incense');
    expect(nextSessionStep({ incense: true, beat: false, sutra: false })).toBe('beat');
    expect(nextSessionStep({ incense: true, beat: false, sutra: true })).toBe('beat');
    expect(nextSessionStep({ incense: true, beat: true, sutra: true })).toBeNull();
  });
});
