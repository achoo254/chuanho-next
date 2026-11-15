import { ROOM_THEMES, checkWish } from '@chuanho/contract';
import { describe, expect, it } from 'vitest';
import { ROOM_WISH_SUGGESTIONS } from './room-wish-suggestions';

describe('room wish suggestions', () => {
  it('offer at least six distinct lines per theme, each passing the wish filter unchanged', () => {
    for (const theme of ROOM_THEMES) {
      const lines = ROOM_WISH_SUGGESTIONS[theme];
      expect(lines.length, theme).toBeGreaterThanOrEqual(6);
      expect(new Set(lines).size, theme).toBe(lines.length);
      for (const line of lines) expect(checkWish(line), line).toEqual({ ok: true, text: line });
    }
  });
});
