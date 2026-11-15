/**
 * Argument parsing for the factory CLI: `--flag value`, `--flag=value`, boolean `--flag`, and positionals. Pure,
 * so `enqueue` flags are validated (through job-params) before anything touches the queue file.
 */
import { parseJobParams } from './job-params';
import type { JobParams } from './job-types';

export interface ParsedArgs {
  readonly command: string | undefined;
  readonly positional: readonly string[];
  readonly flags: ReadonlyMap<string, string | true>;
}

const BOOLEAN_FLAGS = new Set(['once', 'ignore-window', 'dry-run', 'no-voice', 'all', 'help']);

export function parseArgs(argv: readonly string[]): ParsedArgs {
  const positional: string[] = [];
  const flags = new Map<string, string | true>();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] ?? '';
    if (arg === '-h') {
      flags.set('help', true);
    } else if (arg.startsWith('--')) {
      const [name = '', inline] = arg.slice(2).split(/=(.*)/s, 2);
      if (inline !== undefined) flags.set(name, inline);
      else if (BOOLEAN_FLAGS.has(name)) flags.set(name, true);
      else {
        const value = argv[i + 1];
        if (value === undefined || value.startsWith('--')) throw new Error(`--${name} needs a value`);
        flags.set(name, value);
        i += 1;
      }
    } else {
      positional.push(arg);
    }
  }
  return { command: positional[0], positional: positional.slice(1), flags };
}

export function flagString(args: ParsedArgs, name: string): string | undefined {
  const value = args.flags.get(name);
  return typeof value === 'string' ? value : undefined;
}

export function flagNumber(args: ParsedArgs, name: string, fallback: number): number {
  const value = flagString(args, name);
  if (value === undefined) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`--${name} must be a number`);
  return n;
}

const list = (text: string | undefined): string[] => (text ? text.split(',').map((s) => s.trim()).filter(Boolean) : []);

/** `enqueue <kind> [flags]` -> validated job parameters. */
export function enqueueParams(args: ParsedArgs): JobParams {
  const kind = args.positional[0];
  const raw: Record<string, unknown> = { kind };
  if (kind === 'music') raw.count = flagNumber(args, 'count', 8);
  if (kind === 'scene') raw.times = list(flagString(args, 'times') ?? 'morning,noon,evening,night');
  if (kind === 'verse-voice') raw.verseIds = list(flagString(args, 'verses'));
  if (kind === 'video') {
    raw.seconds = flagNumber(args, 'seconds', 30);
    raw.withVoice = !args.flags.has('no-voice');
    const time = flagString(args, 'time');
    if (time !== undefined) raw.time = time;
  }
  const parsed = parseJobParams(raw);
  if ('error' in parsed) throw new Error(parsed.error);
  return parsed.params;
}
