/** Words of Mõ Beat's song choice (the rest of the mode's words live in the main dictionary under `beat.*`). */
import { createFeatureText } from '../features/feature-text';

const vi = {
  source: 'Chọn bài',
  builtIn: 'Nhịp lofi',
  library: 'Bài từ thư viện',
  loading: 'Đang mở bài…',
} as const;

const en: Record<keyof typeof vi, string> = {
  source: 'Pick a song',
  builtIn: 'Lofi beat',
  library: 'A library song',
  loading: 'Opening the song…',
};

export const useBeatText = createFeatureText(vi, en);
