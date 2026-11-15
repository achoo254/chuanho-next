/**
 * Words of the 3D play modes that the 2D screens do not have (the rest reuse the main dictionary). Kept here so the
 * 2D page's bundle does not carry them. Mostly accessible names; on screen the modes stay close to wordless.
 */
import { useCallback } from 'react';
import { format, useI18n } from '../i18n/i18n';

const vi = {
  back: 'Về sân chùa',
  choose: 'Chọn cách gõ mõ',
  strikeArea: 'Gõ mõ: chạm vào màn hình, hoặc nhấn Space',
  holdIncense: 'Giữ để thắp hương: giữ ngón tay hoặc chuột trên lư hương, hoặc giữ Space',
  stepDone: 'Xong một bước',
  next: 'Tiếp: {step}',
  sessionProgress: 'Phiên hôm nay: {done}/3',
  chooseLevel: 'Chọn độ khó rồi bắt đầu',
  start: 'Bắt đầu bài',
  paper: 'Lời kinh',
  capturing: 'Đang chụp sân chùa…',
  wordsLeft: '{n}/{total}',
} as const;

export type PlayKey = keyof typeof vi;

const en: Record<PlayKey, string> = {
  back: 'Back to the yard',
  choose: 'Choose how to drum',
  strikeArea: 'Strike the wooden fish: tap the screen, or press Space',
  holdIncense: 'Hold to light the incense: keep a finger or the mouse on the burner, or hold Space',
  stepDone: 'Step done',
  next: 'Next: {step}',
  sessionProgress: "Today's session: {done}/3",
  chooseLevel: 'Pick a level, then start',
  start: 'Start the song',
  paper: 'Sutra text',
  capturing: 'Taking a picture of the yard…',
  wordsLeft: '{n}/{total}',
};

export type PlayText = (key: PlayKey, vars?: Record<string, string | number>) => string;

export function usePlayText(): PlayText {
  const { locale } = useI18n();
  return useCallback((key, vars) => format(locale === 'en' ? en[key] : vi[key], vars), [locale]);
}
