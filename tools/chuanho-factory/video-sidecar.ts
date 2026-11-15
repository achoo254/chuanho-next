/**
 * The JSON sidecar next to each handoff video (`<id>.json`): what Tiểu Đệ's pipeline needs to post it (title,
 * tags, duration) and where it came from (track, scene, verse). Titles and tags are calm by construction and are
 * checked again by the text guard: no donation asks, no calls to action, no links.
 */
import { calmTextProblems } from './calm-text-guard';
import type { TimeOfDay } from './job-types';

export interface VideoSidecar {
  readonly version: 1;
  readonly id: string;
  readonly title: string;
  readonly tags: readonly string[];
  readonly durationSeconds: number;
  readonly width: number;
  readonly height: number;
  readonly trackId: string;
  readonly scene: { readonly time: TimeOfDay; readonly file: string };
  readonly verse?: { readonly id: string; readonly text: string; readonly voiced: boolean };
  readonly created: string;
  /** Always true: music and picture only, nothing asks the viewer to do anything. */
  readonly musicAndPictureOnly: true;
  readonly license: string;
}

const SCENE_TITLES: Record<TimeOfDay, string> = {
  morning: 'Sương sớm sân chùa',
  noon: 'Nắng trưa sân chùa',
  evening: 'Đèn lồng chiều tối',
  night: 'Trăng đêm sân chùa',
};

const SCENE_TAGS: Record<TimeOfDay, string> = {
  morning: 'buổi sáng',
  noon: 'buổi trưa',
  evening: 'buổi tối',
  night: 'ban đêm',
};

export interface SidecarInput {
  readonly id: string;
  readonly durationSeconds: number;
  readonly width: number;
  readonly height: number;
  readonly trackId: string;
  readonly scene: { readonly time: TimeOfDay; readonly file: string };
  readonly verse?: { readonly id: string; readonly text: string; readonly voiced: boolean };
  readonly created: Date;
}

export function buildSidecar(input: SidecarInput): VideoSidecar {
  return {
    version: 1,
    id: input.id,
    title: `${SCENE_TITLES[input.scene.time]} · nhạc thiền không lời`,
    tags: ['nhạc thiền', 'nhạc không lời', 'thư giãn', 'tĩnh lặng', SCENE_TAGS[input.scene.time]],
    durationSeconds: Math.round(input.durationSeconds * 100) / 100,
    width: input.width,
    height: input.height,
    trackId: input.trackId,
    scene: input.scene,
    ...(input.verse ? { verse: input.verse } : {}),
    created: input.created.toISOString(),
    musicAndPictureOnly: true,
    license: 'AI-generated for the hoandat ecosystem; owned by hoandat, all rights reserved (not CC0)',
  };
}

/** Problems in any text a viewer would see (title, tags, burned-in verse). */
export function sidecarTextProblems(sidecar: VideoSidecar): string[] {
  const texts = [sidecar.title, ...sidecar.tags, ...(sidecar.verse ? [sidecar.verse.text] : [])];
  return texts.flatMap((text) => calmTextProblems(text).map((problem) => `${text}: ${problem}`));
}

/** Parses a sidecar read back from the handoff folder (for usage counts and removals); undefined when foreign. */
export function readSidecar(raw: unknown): Pick<VideoSidecar, 'id' | 'trackId' | 'scene'> & { verseId?: string } | undefined {
  const r = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const scene = typeof r.scene === 'object' && r.scene !== null ? (r.scene as Record<string, unknown>) : {};
  const verse = typeof r.verse === 'object' && r.verse !== null ? (r.verse as Record<string, unknown>) : {};
  if (r.version !== 1 || typeof r.id !== 'string' || typeof r.trackId !== 'string' || typeof scene.file !== 'string') return undefined;
  const time = scene.time;
  if (time !== 'morning' && time !== 'noon' && time !== 'evening' && time !== 'night') return undefined;
  return { id: r.id, trackId: r.trackId, scene: { time, file: scene.file }, ...(typeof verse.id === 'string' ? { verseId: verse.id } : {}) };
}
