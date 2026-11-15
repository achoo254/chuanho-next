import { describe, expect, it } from 'vitest';
import { createListenReporter } from './music-listen-report';

const LONG = { id: 'm001', duration: 180 };
const SHORT = { id: 'm002', duration: 40 };

function harness(online = true): { sent: string[]; setOnline(next: boolean): void; reporter: ReturnType<typeof createListenReporter> } {
  const sent: string[] = [];
  let isOnline = online;
  const reporter = createListenReporter({ send: (id) => sent.push(id), isOnline: () => isOnline });
  return { sent, setOnline: (next) => (isOnline = next), reporter };
}

describe('listen reporter', () => {
  it('reports a track once it has played 30 s, or half of a short one', () => {
    const { sent, reporter } = harness();
    reporter.heard(LONG, 29.5);
    reporter.heard(SHORT, 19.9);
    expect(sent).toEqual([]);
    reporter.heard(LONG, 30.1);
    reporter.heard(SHORT, 20);
    expect(sent).toEqual(['m001', 'm002']);
  });

  it('reports each track only once per session', () => {
    const { sent, reporter } = harness();
    reporter.heard(LONG, 31);
    reporter.heard(LONG, 90);
    reporter.heard(LONG, 40);
    expect(sent).toEqual(['m001']);
  });

  it('sends nothing offline and reports when the connection is back', () => {
    const { sent, setOnline, reporter } = harness(false);
    reporter.heard(LONG, 35);
    expect(sent).toEqual([]);
    setOnline(true);
    reporter.heard(LONG, 36);
    expect(sent).toEqual(['m001']);
  });

  it('swallows a failing sender', () => {
    const reporter = createListenReporter({
      send: () => {
        throw new Error('network');
      },
      isOnline: () => true,
    });
    expect(() => reporter.heard(LONG, 31)).not.toThrow();
  });
});
