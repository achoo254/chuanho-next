/**
 * Decodes an audio file to mono 32-bit float PCM at the analysis rate with ffmpeg (must be on PATH). The whole
 * track is held in memory: three minutes at 11 kHz is about 8 MB.
 */
import { spawn } from 'node:child_process';
import { ANALYSIS_RATE } from './onset-envelope';

/** Longest track accepted (the library's tracks are 1-3 minutes); guards memory against a wrong file. */
const MAX_SECONDS = 30 * 60;

export function decodeMono(file: string): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    const args = ['-v', 'error', '-nostdin', '-i', file, '-ac', '1', '-ar', String(ANALYSIS_RATE), '-f', 'f32le', '-t', String(MAX_SECONDS), 'pipe:1'];
    const child = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks: Buffer[] = [];
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => reject(new Error(`ffmpeg could not start (is it on PATH?): ${error.message}`)));
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg failed on ${file} (exit ${code ?? 'signal'}): ${stderr.trim().slice(0, 500)}`));
        return;
      }
      const bytes = Buffer.concat(chunks);
      const usable = bytes.length - (bytes.length % 4);
      // Copy into an aligned buffer: Buffer.concat's offset inside its pool need not be a multiple of 4.
      const aligned = new ArrayBuffer(usable);
      new Uint8Array(aligned).set(bytes.subarray(0, usable));
      resolve(new Float32Array(aligned));
    });
  });
}
