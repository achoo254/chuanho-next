import { describe, expect, it } from 'vitest';
import { commandForKey } from '../input/keyboard-commands';
import { rendererPreference } from '../engine/game-3d-flag';
import { INTERACTIVE_PROPS, SHORTCUT_BAR_ACTIONS, actionsForProp, isComingSoon, propForAction } from './world-actions';

describe('world actions', () => {
  it('give every tappable prop at least one action, and scenery none', () => {
    for (const prop of INTERACTIVE_PROPS) expect(actionsForProp(prop).length).toBeGreaterThan(0);
    expect(actionsForProp('lantern')).toEqual([]);
    expect(actionsForProp(undefined)).toEqual([]);
  });

  it('send the censer to incense, the wooden fish to both drumming modes and the board to its three tools', () => {
    expect(actionsForProp('censer')).toEqual(['incense']);
    expect(actionsForProp('mo')).toEqual(['beat', 'endless']);
    expect(actionsForProp('woodenBoard')).toEqual(['journal', 'gentle', 'radio']);
    expect(actionsForProp('woodenBoard').some(isComingSoon)).toBe(false);
    expect(isComingSoon('incense')).toBe(false);
  });

  it('open the shared room; only the fortune is still coming soon', () => {
    expect(isComingSoon('room')).toBe(false);
    expect(isComingSoon('fortune')).toBe(true);
  });

  it('find the prop behind each corner-bar action so it can glow', () => {
    // Fortune and the room have no prop in the yard yet (a fortune tube and a lantern would be their props).
    for (const action of SHORTCUT_BAR_ACTIONS.filter((a) => a !== 'fortune' && a !== 'room')) expect(propForAction(action)).not.toBeNull();
    expect(propForAction('strike')).toBe('mo');
  });
});

describe('commandForKey', () => {
  it('strikes on Space and Enter unless a control has focus', () => {
    expect(commandForKey(' ', false)).toEqual({ kind: 'action', action: 'strike' });
    expect(commandForKey('Enter', false)).toEqual({ kind: 'action', action: 'strike' });
    expect(commandForKey(' ', true)).toBeNull();
    expect(commandForKey('Enter', true)).toBeNull();
  });

  it('picks the session steps with 1 to 3, goes back on Escape and ignores other keys', () => {
    expect(commandForKey('1', false)).toEqual({ kind: 'action', action: 'incense' });
    expect(commandForKey('2', true)).toEqual({ kind: 'action', action: 'beat' });
    expect(commandForKey('3', false)).toEqual({ kind: 'action', action: 'sutra' });
    expect(commandForKey('4', false)).toBeNull();
    expect(commandForKey('Escape', true)).toEqual({ kind: 'back' });
    expect(commandForKey('a', false)).toBeNull();
  });
});

describe('rendererPreference', () => {
  it('forces WebGL2 only when asked', () => {
    expect(rendererPreference('?v=3d&renderer=webgl2')).toBe('webgl2');
    expect(rendererPreference('?v=3d')).toBe('auto');
  });
});
