/**
 * Words of the radio screen: mostly icons on screen, so these are short labels, hints and accessible names.
 * Tone: short, Gen-Z, cosy. A new mode in radio-modes.ts needs its `mode.<id>` line here.
 */
import { createFeatureText } from '../feature-text';
import type { RadioModeId } from './radio-modes';

type ModeKey = `mode.${RadioModeId}`;

const vi = {
  title: 'Đài',
  modes: 'Chế độ',
  'mode.auto': 'Tự theo giờ',
  'mode.autoLabel': 'Tự theo giờ: {mode}',
  'mode.sleep': 'Đi ngủ',
  'mode.work': 'Cày deadline',
  play: 'Phát',
  pause: 'Tạm dừng',
  skip: 'Qua bài',
  track: 'Bài {n}',
  listened: '{n} phút nghe',
  timers: 'Hẹn giờ tắt',
  'timer.minutes': '{n}p',
  'timer.minutesLabel': 'Tắt sau {n} phút',
  'timer.untilStop': '∞',
  'timer.untilStopLabel': 'Tới khi mình tắt',
  'timer.left': 'Tắt sau {time}',
  'timer.done': 'Nhạc tắt rồi, ngủ ngon nha',
  dim: 'Tắt màn',
  wake: 'Chạm để thức',
  'focus.focus': 'Tập trung {time}',
  'focus.break': 'Nghỉ xíu {time}',
  'focus.toggle': 'Chuông nghỉ 25/5',
  'focus.hint': 'Chuông nhẹ báo nghỉ, báo vào lại',
} as const satisfies Record<string, string> & Record<ModeKey, string>;

type RadioKey = keyof typeof vi;

const en: Readonly<Record<RadioKey, string>> = {
  title: 'Radio',
  modes: 'Mode',
  'mode.auto': 'By the clock',
  'mode.autoLabel': 'By the clock: {mode}',
  'mode.sleep': 'Sleep',
  'mode.work': 'Deadline grind',
  play: 'Play',
  pause: 'Pause',
  skip: 'Next track',
  track: 'Track {n}',
  listened: '{n} min heard',
  timers: 'Sleep timer',
  'timer.minutes': '{n}m',
  'timer.minutesLabel': 'Off in {n} minutes',
  'timer.untilStop': '∞',
  'timer.untilStopLabel': 'Until I stop it',
  'timer.left': 'Off in {time}',
  'timer.done': 'Music is off. Sleep well',
  dim: 'Dim screen',
  wake: 'Tap to wake',
  'focus.focus': 'Focus {time}',
  'focus.break': 'Break {time}',
  'focus.toggle': '25/5 break chimes',
  'focus.hint': 'A soft chime for breaks and back to work',
};

export const useRadioText = createFeatureText<RadioKey>(vi, en);
