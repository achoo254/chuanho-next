/**
 * Beatmaps for the music library: `tsx tools/chuanho-beatmap/cli.ts <library-dir> [--out <dir>]`.
 *
 * Reads <library-dir>/manifest.json, decodes each track with ffmpeg, and writes <out>/beatmaps/<trackId>.json plus
 * <out>/beatmaps/index.json (<out> defaults to the library directory, so infra/upload-music.sh finds the folder
 * next to the tracks). Track files first, the index last; every file is written to a temporary name and renamed,
 * so an interrupted run never leaves half a file. A track that fails to decode is reported and left out of the
 * index. Prints one line per track and a summary; exits 1 when no track could be analysed.
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { analyzeTrack, BEATMAP_VERSION, type BeatmapIndexEntry } from './analyze-track';
import { decodeMono } from './decode-audio';
import { parseLibraryManifest } from './library-manifest';

const USAGE = 'usage: tsx tools/chuanho-beatmap/cli.ts <library-dir> [--out <dir>]';

function parseArgs(argv: readonly string[]): { library: string; out: string } {
  const positional: string[] = [];
  let out: string | undefined;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--out') {
      out = argv[i + 1];
      if (!out) throw new Error(`--out needs a directory\n${USAGE}`);
      i += 1;
    } else if (arg === '-h' || arg === '--help') {
      console.log(USAGE);
      process.exit(0);
    } else if (arg !== undefined) {
      positional.push(arg);
    }
  }
  const library = positional[0];
  if (!library || positional.length > 1) throw new Error(USAGE);
  return { library: path.resolve(library), out: path.resolve(out ?? library) };
}

async function writeJsonAtomic(file: string, value: unknown): Promise<void> {
  const temp = `${file}.tmp-${process.pid}`;
  await writeFile(temp, `${JSON.stringify(value)}\n`, 'utf8');
  await rename(temp, file);
}

async function main(): Promise<void> {
  const { library, out } = parseArgs(process.argv.slice(2));
  const { tracks, skipped } = parseLibraryManifest(JSON.parse(await readFile(path.join(library, 'manifest.json'), 'utf8')));
  for (const line of skipped) console.warn(`skipped ${line}`);
  const dir = path.join(out, 'beatmaps');
  await mkdir(dir, { recursive: true });

  const index: BeatmapIndexEntry[] = [];
  let failed = 0;
  for (const track of tracks) {
    try {
      const { beatmap, index: entry, detail } = analyzeTrack(track.id, await decodeMono(path.join(library, track.file)));
      await writeJsonAtomic(path.join(dir, `${track.id}.json`), beatmap);
      index.push(entry);
      const notes = beatmap.levels ? ` notes ${beatmap.levels.easy.length}/${beatmap.levels.normal.length}/${beatmap.levels.hard.length}` : '';
      console.log(
        `${track.id} bpm ${beatmap.bpm} (raw ${detail.rawBpm}) conf ${beatmap.confidence} [hit ${detail.hitRate} steady ${detail.steadiness} contrast ${detail.contrast}] ${beatmap.playable ? 'playable' : 'not playable'}${notes}`,
      );
    } catch (error) {
      failed += 1;
      console.error(`${track.id} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  await writeJsonAtomic(path.join(dir, 'index.json'), { version: BEATMAP_VERSION, tracks: index });

  const playable = index.filter((entry) => entry.playable).length;
  console.log(`${index.length} analysed, ${playable} playable, ${failed} failed, ${skipped.length} skipped -> ${dir}`);
  if (index.length === 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
