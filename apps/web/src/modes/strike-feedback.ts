/**
 * Sound and touch for a strike. The mallet lands STRIKE_CONTACT_MS (45 ms) after the touch, and the wooden fish's
 * sound is scheduled on the audio clock for that exact moment: picture and sound agree, and the sound lands 45 ms
 * after the finger (plus the device's own output latency), inside the 50 ms budget. The vibration fires at the touch
 * itself, since a phone's motor needs a few tens of milliseconds to spin up, which brings it near the hit too.
 */
import { audioEngine, buzz, playSample } from '../audio/audio-engine';
import { STRIKE_CONTACT_MS } from '../character/strike-timeline';

export function playStrikeFeedback(buzzMs = 12): void {
  const engine = audioEngine();
  playSample('mo', engine ? { when: engine.ctx.currentTime + STRIKE_CONTACT_MS / 1000 } : {});
  buzz(buzzMs);
}
