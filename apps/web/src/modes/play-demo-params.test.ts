import { describe, expect, it } from 'vitest';
import { playDemoParams } from './play-demo-params';

describe('playDemoParams', () => {
  it('is empty for a normal address', () => {
    expect(playDemoParams('?v=3d')).toEqual({ mode: null, freezeStrikeMs: null, songMs: null, roomGame: false });
  });

  it('reads a known mode, a strike freeze and a song time', () => {
    expect(playDemoParams('?v=3d&play=beat&song=4200&freeze=45')).toEqual({ mode: 'beat', freezeStrikeMs: 45, songMs: 4200, roomGame: false });
    expect(playDemoParams('?play=sutra').mode).toBe('sutra');
  });

  it('opens the room for the minigame preview', () => {
    expect(playDemoParams('?play=room-game')).toMatchObject({ mode: 'room', roomGame: true });
    expect(playDemoParams('?play=room').roomGame).toBe(false);
  });

  it('ignores unknown modes, bad numbers, and a song time outside Mõ Beat', () => {
    expect(playDemoParams('?play=shop').mode).toBeNull();
    expect(playDemoParams('?freeze=-3').freezeStrikeMs).toBeNull();
    expect(playDemoParams('?freeze=abc').freezeStrikeMs).toBeNull();
    expect(playDemoParams('?play=endless&song=4000').songMs).toBeNull();
  });
});
