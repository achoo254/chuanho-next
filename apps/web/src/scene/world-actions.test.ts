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

  it('send the censer to incense, the wooden fish to both drumming modes and the board to its four tools', () => {
    expect(actionsForProp('censer')).toEqual(['incense']);
    expect(actionsForProp('mo')).toEqual(['beat', 'endless']);
    expect(actionsForProp('woodenBoard')).toEqual(['journal', 'gentle', 'fortune', 'radio']);
    expect(actionsForProp('woodenBoard').some(isComingSoon)).toBe(false);
    expect(isComingSoon('incense')).toBe(false);
  });

  it('have nothing left coming soon: the room and the fortune both open', () => {
    expect(isComingSoon('room')).toBe(false);
    expect(isComingSoon('fortune')).toBe(false);
  });

  it('put the fortune on the corner bar right after the gentle words', () => {
    expect(SHORTCUT_BAR_ACTIONS.indexOf('fortune')).toBe(SHORTCUT_BAR_ACTIONS.indexOf('gentle') + 1);
  });

  it('find the prop behind each corner-bar action so it can glow', () => {
    // The room has no prop in the yard yet (a lantern would be its prop).
    for (const action of SHORTCUT_BAR_ACTIONS.filter((a) => a !== 'room')) expect(propForAction(action)).not.toBeNull();
    expect(propForAction('fortune')).toBe('woodenBoard');
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
