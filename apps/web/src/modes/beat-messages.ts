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

const zhCN: Record<keyof typeof vi, string> = {
  source: '选择曲目',
  builtIn: 'Lofi 节拍',
  library: '曲库中的歌',
  loading: '正在打开曲目…',
};

export const useBeatText = createFeatureText(vi, en, zhCN);
