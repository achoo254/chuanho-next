/**
 * `pnpm check:gentle`: editorial guard of the gentle phrase bank (apps/web/public/content/gentle-phrases.json).
 * Runs the same rules as the unit test (gentle-bank-rules.ts): usable by the app's parser, ids unique, enough
 * sentences per tone and per apology kind, lengths, no duplicates, no links/phones/emails, no rude or scripture words.
 * Prints the counts; exits 1 listing every problem.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditGentleBank } from '../apps/web/src/features/gentle/gentle-bank-rules';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BANK_FILE = path.join(ROOT, 'apps/web/public/content/gentle-phrases.json');

async function main(): Promise<void> {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(BANK_FILE, 'utf8'));
  } catch (error) {
    console.error(`check:gentle: cannot read ${path.relative(ROOT, BANK_FILE)}:`, error instanceof Error ? error.message : error);
    process.exit(1);
  }
  const audit = auditGentleBank(raw);
  const groups = Object.entries(audit.perGroup)
    .map(([group, count]) => `${group} ${count}`)
    .join(', ');
  console.log(`check:gentle: ${audit.situations} situations (${groups}), ${audit.sentences} sentences, ${audit.apologies} apologies`);
  if (audit.problems.length > 0) {
    for (const problem of audit.problems) console.error(`  - ${problem}`);
    console.error(`check:gentle: ${audit.problems.length} problem(s)`);
    process.exit(1);
  }
  console.log('check:gentle: ok');
}

await main();
