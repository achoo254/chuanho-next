/**
 * Folders under the media directory (outside the repo). Every producer and consumer resolves paths here, so the
 * layout is written down once.
 */
import path from 'node:path';

export interface MediaLayout {
  /** Raw ACE-Step takes, jobs.jsonl, features and qc-report.json of tools/chuanho-music. */
  readonly musicRaw: string;
  /** QC-passed, encoded library: manifest.json, m###-<hash>.mp3, beatmaps/. */
  readonly library: string;
  readonly scenes: string;
  readonly voices: string;
  /** Handoff folder for Tiểu Đệ: <id>.mp4 + <id>.json. */
  readonly videos: string;
  /** The bundle upload-music.sh sends: only QC-passed, not removed tracks. */
  readonly publish: string;
  readonly work: string;
}

export function mediaLayout(mediaDir: string): MediaLayout {
  return {
    musicRaw: path.join(mediaDir, 'music-raw'),
    library: path.join(mediaDir, 'library'),
    scenes: path.join(mediaDir, 'scenes'),
    voices: path.join(mediaDir, 'voices'),
    videos: path.join(mediaDir, 'videos'),
    publish: path.join(mediaDir, 'publish', 'library'),
    work: path.join(mediaDir, 'work'),
  };
}

/** Forward slashes, for commands an operator pastes into Git Bash. */
export function posixPath(file: string): string {
  return file.replace(/\\/g, '/');
}
