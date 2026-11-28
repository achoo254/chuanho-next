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

const zhCN: Readonly<Record<RadioKey, string>> = {
  title: '电台',
  modes: '模式',
  'mode.auto': '按时段自动',
  'mode.autoLabel': '按时段自动：{mode}',
  'mode.sleep': '睡眠',
  'mode.work': '赶 deadline',
  play: '播放',
  pause: '暂停',
  skip: '下一首',
  track: '第 {n} 首',
  listened: '已听 {n} 分钟',
  timers: '定时关闭',
  'timer.minutes': '{n}分',
  'timer.minutesLabel': '{n} 分钟后关闭',
  'timer.untilStop': '∞',
  'timer.untilStopLabel': '直到我手动关闭',
  'timer.left': '{time} 后关闭',
  'timer.done': '音乐已关，晚安',
  dim: '熄屏',
  wake: '点一下唤醒',
  'focus.focus': '专注 {time}',
  'focus.break': '休息 {time}',
  'focus.toggle': '25/5 休息铃',
  'focus.hint': '轻柔的铃声提醒休息和回来工作',
};

export const useRadioText = createFeatureText<RadioKey>(vi, en, zhCN);
