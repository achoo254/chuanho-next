/**
 * The music library's tables: track metadata (soft-removed, never deleted, so a re-ingest cannot bring a taken-down
 * track back) and today's listener hashes that keep a listen from being counted twice.
 */
import {
  LIBRARY_MAX_TAGS,
  LIBRARY_MAX_TRACKS,
  type LibraryIngestResponse,
  type LibraryIngestTrack,
  type LibraryManifestTrack,
  type LibraryRemovedTrack,
  type LibraryTrack,
} from '@chuanho/contract';
import { and, asc, count, eq, inArray, lt, notInArray, sql } from 'drizzle-orm';
import type { Db, Tx } from '../db/client';
import { libraryListens, libraryTracks } from '../db/schema';

/** Removal reason written when an ingest takes tracks down to stay under the cap. */
export const OVER_CAP_REASON = 'over-cap: least listened';

type TrackRow = typeof libraryTracks.$inferSelect;

function toTrack(row: TrackRow): LibraryTrack {
  return {
    id: row.id,
    file: row.file,
    duration: row.duration,
    tags: row.tags,
    addedAt: row.addedAt.getTime(),
    listens: row.listens,
    removed: row.removed,
    ...(row.bpm !== null ? { bpm: row.bpm } : {}),
    ...(row.playableBeatmap !== null ? { playableBeatmap: row.playableBeatmap } : {}),
  };
}

function toRemoved(row: Pick<TrackRow, 'id' | 'file' | 'removedAt' | 'removedReason'>): LibraryRemovedTrack {
  return { id: row.id, file: row.file, reason: row.removedReason ?? '', removedAt: row.removedAt?.getTime() ?? 0 };
}

/** The tracks still in the library, as the player's manifest lists them. */
export async function readLibraryManifest(db: Db): Promise<LibraryManifestTrack[]> {
  const rows = await db
    .select({ id: libraryTracks.id, file: libraryTracks.file, duration: libraryTracks.duration, tags: libraryTracks.tags })
    .from(libraryTracks)
    .where(eq(libraryTracks.removed, false))
    .orderBy(asc(libraryTracks.id));
  return rows;
}

export async function readLibraryTracks(db: Db): Promise<LibraryTrack[]> {
  const rows = await db.select().from(libraryTracks).orderBy(asc(libraryTracks.id));
  return rows.map(toTrack);
}

export async function readRemovedTracks(db: Db): Promise<LibraryRemovedTrack[]> {
  const rows = await db.select().from(libraryTracks).where(eq(libraryTracks.removed, true)).orderBy(asc(libraryTracks.id));
  return rows.map(toRemoved);
}

async function activeCount(tx: Tx | Db): Promise<number> {
  const [row] = await tx.select({ n: count() }).from(libraryTracks).where(eq(libraryTracks.removed, false));
  return row?.n ?? 0;
}

const mergeTags = (kept: readonly string[], added: readonly string[]): string[] => [...new Set([...kept, ...added])].slice(0, LIBRARY_MAX_TAGS);

/**
 * Registers or refreshes tracks by id: file, duration and beat data follow the ingest, tags are merged, listens and the
 * removed flag are kept. Past `LIBRARY_MAX_TRACKS` live tracks, the least-heard and then oldest tracks outside this
 * ingest are taken down and returned, so the operator can delete their files.
 */
export async function ingestLibraryTracks(db: Db, tracks: readonly LibraryIngestTrack[], at: Date): Promise<LibraryIngestResponse> {
  return db.transaction(async (tx) => {
    const ids = tracks.map((track) => track.id);
    const existing = new Map((await tx.select().from(libraryTracks).where(inArray(libraryTracks.id, ids)).for('update')).map((row) => [row.id, row]));
    let added = 0;
    for (const track of tracks) {
      const beat = {
        ...(track.bpm !== undefined ? { bpm: track.bpm } : {}),
        ...(track.playableBeatmap !== undefined ? { playableBeatmap: track.playableBeatmap } : {}),
      };
      const kept = existing.get(track.id);
      if (kept) {
        await tx
          .update(libraryTracks)
          .set({ file: track.file, duration: track.duration, tags: mergeTags(kept.tags, track.tags), ...beat })
          .where(eq(libraryTracks.id, track.id));
      } else {
        await tx.insert(libraryTracks).values({ id: track.id, file: track.file, duration: track.duration, tags: [...track.tags], addedAt: at, ...beat });
        added += 1;
      }
    }
    const excess = (await activeCount(tx)) - LIBRARY_MAX_TRACKS;
    let pruned: LibraryRemovedTrack[] = [];
    if (excess > 0) {
      // The ingest itself holds at most LIBRARY_MAX_TRACKS tracks, so there are always enough older ones to take down.
      const victims = await tx
        .select({ id: libraryTracks.id })
        .from(libraryTracks)
        .where(and(eq(libraryTracks.removed, false), notInArray(libraryTracks.id, ids)))
        .orderBy(asc(libraryTracks.listens), asc(libraryTracks.addedAt), asc(libraryTracks.id))
        .limit(excess);
      const rows = await tx
        .update(libraryTracks)
        .set({ removed: true, removedAt: at, removedReason: OVER_CAP_REASON })
        .where(
          inArray(
            libraryTracks.id,
            victims.map((victim) => victim.id),
          ),
        )
        .returning();
      pruned = rows.map(toRemoved).sort((a, b) => a.id.localeCompare(b.id));
    }
    return { added, updated: tracks.length - added, active: await activeCount(tx), pruned };
  });
}

/** Takes a track down ("gỡ bản"). Idempotent: a second removal keeps the first reason and time. Null for an unknown id. */
export async function removeLibraryTrack(db: Db, id: string, reason: string, at: Date): Promise<LibraryRemovedTrack | null> {
  await db
    .update(libraryTracks)
    .set({ removed: true, removedAt: at, removedReason: reason })
    .where(and(eq(libraryTracks.id, id), eq(libraryTracks.removed, false)));
  const [row] = await db.select().from(libraryTracks).where(eq(libraryTracks.id, id));
  return row ? toRemoved(row) : null;
}

export type RestoreResult = { readonly kind: 'restored'; readonly track: LibraryTrack } | { readonly kind: 'unknown' } | { readonly kind: 'full' };

/** Puts a removed track back (its file must still be on disk), unless the library is already full. */
export async function restoreLibraryTrack(db: Db, id: string): Promise<RestoreResult> {
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(libraryTracks).where(eq(libraryTracks.id, id)).for('update');
    if (!row) return { kind: 'unknown' };
    if (!row.removed) return { kind: 'restored', track: toTrack(row) };
    if ((await activeCount(tx)) >= LIBRARY_MAX_TRACKS) return { kind: 'full' };
    const [restored] = await tx
      .update(libraryTracks)
      .set({ removed: false, removedAt: null, removedReason: null })
      .where(eq(libraryTracks.id, id))
      .returning();
    return restored ? { kind: 'restored', track: toTrack(restored) } : { kind: 'unknown' };
  });
}

export type ListenResult = 'counted' | 'repeat' | 'unknown';

/** Counts one listen of a live track, once per listener hash per day. */
export async function recordLibraryListen(db: Db, trackId: string, day: string, clientHash: string): Promise<ListenResult> {
  return db.transaction(async (tx) => {
    const [track] = await tx.select({ removed: libraryTracks.removed }).from(libraryTracks).where(eq(libraryTracks.id, trackId));
    if (!track || track.removed) return 'unknown';
    const inserted = await tx.insert(libraryListens).values({ trackId, day, clientHash }).onConflictDoNothing().returning({ day: libraryListens.day });
    if (inserted.length === 0) return 'repeat';
    await tx
      .update(libraryTracks)
      .set({ listens: sql`${libraryTracks.listens} + 1` })
      .where(eq(libraryTracks.id, trackId));
    return 'counted';
  });
}

/** Drops the listener hashes of days before `day`: they only ever deduplicate today's listens. */
export async function pruneLibraryListensBefore(db: Db, day: string): Promise<void> {
  await db.delete(libraryListens).where(lt(libraryListens.day, day));
}
