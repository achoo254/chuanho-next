/**
 * Factory configuration. Nothing machine-specific lives in the repo: the state directory comes from
 * CHUANHO_FACTORY_HOME (default: the user config dir), optional keys from `<state dir>/config.json`, and the
 * ComfyUI address from the same lookup as artgen (ARTGEN_URL, then ~/.config/inet-artgen/env, then local).
 */
import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseWindow, type DailyWindow } from './schedule-window';

export interface FactoryConfig {
  readonly stateDir: string;
  /** Raw takes, library, scenes, voices, videos and the publish bundle; outside the repo. */
  readonly mediaDir: string;
  readonly window: DailyWindow;
  readonly gpuBusyPercent: number;
  readonly gpuBusySamples: number;
  /** Pause when less VRAM than this is free; 0 turns the check off (ComfyUI keeps idle models in VRAM). */
  readonly gpuMinFreeMiB: number;
  readonly sampleSeconds: number;
  readonly minPauseSeconds: number;
  readonly maxPauseSeconds: number;
  readonly maxAttempts: number;
  readonly python: string;
  /** Python of the venv that has faster-whisper, for asr-check.py; verse-voice jobs fail until it is set. */
  readonly asrPython: string | undefined;
  readonly artgenDir: string;
  readonly musicToolDir: string;
  readonly voiceToolDir: string;
  /** chuanho-next checkout (beatmap CLI, upload script, tsx). */
  readonly repoRoot: string;
  readonly fontFile: string | undefined;
  readonly comfyUrl: string;
  readonly libraryHours: number;
  readonly libraryKbps: number;
  readonly verseVoice: string;
  /** Public origin of the game; admin calls to the library API send it as `Origin`. */
  readonly publicUrl: string;
  /** Env file (outside git) holding LIBRARY_ADMIN_TOKEN; only its path is used, the value is never printed. */
  readonly libraryEnvFile: string | undefined;
}

export interface ConfigInput {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly home: string;
  readonly platform: NodeJS.Platform;
  readonly repoRoot: string;
  /** Parsed `<state dir>/config.json`, or undefined when there is none. */
  readonly file: unknown;
  /** Text of ~/.config/inet-artgen/env, or '' when absent. */
  readonly artgenEnv: string;
}

const LOCAL_COMFY = 'http://127.0.0.1:8188';

export function defaultStateDir(env: ConfigInput['env'], home: string, platform: NodeJS.Platform): string {
  if (env.CHUANHO_FACTORY_HOME) return env.CHUANHO_FACTORY_HOME;
  if (platform === 'win32' && env.APPDATA) return path.join(env.APPDATA, 'chuanho-factory');
  return path.join(env.XDG_CONFIG_HOME ?? path.join(home, '.config'), 'chuanho-factory');
}

/** `KEY=VALUE` lookup with artgen's precedence: environment first, then the env file. */
export function lookupArtgenEnv(key: string, env: ConfigInput['env'], fileText: string): string | undefined {
  if (env[key]) return env[key];
  for (const line of fileText.split(/\r?\n/)) {
    const [name, ...rest] = line.trim().split('=');
    const value = rest.join('=').trim();
    if (rest.length > 0 && name?.trim() === key && value) return value;
  }
  return undefined;
}

export function resolveConfig(input: ConfigInput): FactoryConfig {
  const file = typeof input.file === 'object' && input.file !== null ? (input.file as Record<string, unknown>) : {};
  const errors: string[] = [];
  const num = (key: string, fallback: number, min: number, max: number): number => {
    const value = file[key] ?? fallback;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
      errors.push(`${key} must be a number ${min}-${max}`);
      return fallback;
    }
    return value;
  };
  const str = (key: string): string | undefined => {
    const value = file[key];
    if (value === undefined) return undefined;
    if (typeof value !== 'string' || !value.trim()) {
      errors.push(`${key} must be a non-empty string`);
      return undefined;
    }
    return value;
  };
  const stateDir = defaultStateDir(input.env, input.home, input.platform);
  const venv = path.join(input.home, '.claude', 'skills', '.venv');
  const workspaceTools = path.resolve(input.repoRoot, '..', 'tools');
  let window = parseWindow('23:00-07:00');
  const windowText = str('window');
  if (windowText) {
    try {
      window = parseWindow(windowText);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  const config: FactoryConfig = {
    stateDir,
    mediaDir: input.env.CHUANHO_FACTORY_MEDIA ?? str('mediaDir') ?? path.join(stateDir, 'media'),
    window,
    gpuBusyPercent: num('gpuBusyPercent', 30, 1, 100),
    gpuBusySamples: num('gpuBusySamples', 3, 1, 60),
    gpuMinFreeMiB: num('gpuMinFreeMiB', 0, 0, 1_000_000),
    sampleSeconds: num('sampleSeconds', 20, 1, 3600),
    minPauseSeconds: num('minPauseSeconds', 60, 1, 86_400),
    maxPauseSeconds: num('maxPauseSeconds', 1800, 1, 86_400),
    maxAttempts: num('maxAttempts', 3, 1, 20),
    python: str('python') ?? (input.platform === 'win32' ? path.join(venv, 'Scripts', 'python.exe') : path.join(venv, 'bin', 'python3')),
    asrPython: str('asrPython') ?? input.env.ASR_PYTHON,
    artgenDir: str('artgenDir') ?? path.join(input.home, '.claude', 'skills', 'inet-artgen'),
    musicToolDir: str('musicToolDir') ?? path.join(workspaceTools, 'chuanho-music'),
    voiceToolDir: str('voiceToolDir') ?? path.join(workspaceTools, 'chuanho-voice'),
    repoRoot: input.repoRoot,
    fontFile: str('fontFile'),
    comfyUrl: (lookupArtgenEnv('ARTGEN_URL', input.env, input.artgenEnv) ?? LOCAL_COMFY).replace(/\/+$/, ''),
    libraryHours: num('libraryHours', 4.2, 0.1, 100),
    libraryKbps: num('libraryKbps', 40, 24, 192),
    verseVoice: str('verseVoice') ?? 'Thiền Tâm Đức',
    publicUrl: (str('publicUrl') ?? 'https://chuanho.hoandat.com').replace(/\/+$/, ''),
    libraryEnvFile: str('libraryEnvFile'),
  };
  if (config.minPauseSeconds > config.maxPauseSeconds) errors.push('minPauseSeconds must not exceed maxPauseSeconds');
  if (errors.length > 0) throw new Error(`invalid factory config: ${errors.join('; ')}`);
  return config;
}

/** The chuanho-next checkout this file lives in. */
export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

async function readOptional(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

export async function loadConfig(env: NodeJS.ProcessEnv = process.env): Promise<FactoryConfig> {
  const home = os.homedir();
  const stateDir = defaultStateDir(env, home, process.platform);
  const fileText = await readOptional(path.join(stateDir, 'config.json'));
  let file: unknown;
  if (fileText !== undefined) {
    try {
      file = JSON.parse(fileText);
    } catch (error) {
      throw new Error(`${path.join(stateDir, 'config.json')} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  }
  const artgenEnv = (await readOptional(path.join(home, '.config', 'inet-artgen', 'env'))) ?? '';
  return resolveConfig({ env, home, platform: process.platform, repoRoot: REPO_ROOT, file, artgenEnv });
}
