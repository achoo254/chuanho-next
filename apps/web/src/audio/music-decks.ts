/**
 * Two media elements ("decks") that stream the music library into the music bus, so one track can fade into the
 * next. Long tracks are streamed, never decoded into memory. A media element can be wired into WebAudio only once,
 * so the decks are made a single time, inside the Start tap, which is also when iOS Safari lets an element play:
 * each deck plays a muted bundled clip once in that gesture, which allows later play() calls without a tap.
 */

export interface MusicDeck {
  readonly element: HTMLAudioElement;
  /** Fade gain of this deck, feeding the music bus. */
  readonly gain: GainNode;
}

/** A short bundled sound used only to unlock the decks (played muted). */
const PRIME_SRC = '/audio/pulse.wav';

function primeInGesture(element: HTMLAudioElement): void {
  element.muted = true;
  element.src = PRIME_SRC;
  element
    .play()
    .then(() => element.pause())
    .catch((error: unknown) => console.warn('Music deck could not be unlocked; it will retry on play', error))
    .finally(() => {
      element.muted = false;
    });
}

/** Makes and unlocks the two decks; call inside the user gesture that starts audio. Null where it fails. */
export function createMusicDecks(ctx: AudioContext, bus: AudioNode): readonly [MusicDeck, MusicDeck] | null {
  try {
    const make = (): MusicDeck => {
      const element = new Audio();
      element.preload = 'auto';
      const gain = ctx.createGain();
      gain.gain.value = 0;
      ctx.createMediaElementSource(element).connect(gain).connect(bus);
      primeInGesture(element);
      return { element, gain };
    };
    return [make(), make()];
  } catch (error) {
    console.warn('Music decks unavailable; the bundled loop will play instead', error);
    return null;
  }
}
