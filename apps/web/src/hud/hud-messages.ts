/**
 * Words of the 3D game's HUD. Nearly everything on screen is an icon, so these are mostly accessible names and
 * hover hints. Kept beside the HUD (not in the main dictionary) so the 2D page's bundle does not carry them.
 */
import { useCallback } from 'react';
import { format, useI18n } from '../i18n/i18n';
import type { LightingPresetId } from '../scene/lighting-presets';
import type { InteractivePropId, WorldAction } from '../scene/world-actions';

const vi = {
  canvas: 'Sân chùa 3D: bấm vào lư hương, giá kinh, mõ, chuông, bát hoặc bảng gỗ',
  loading: 'Đang mở cổng chùa',
  start: 'Bắt đầu',
  info: 'Giới thiệu và cam kết',
  close: 'Đóng',
  soundOff: 'Tắt tiếng',
  soundOn: 'Bật tiếng',
  timeOfDay: 'Đổi giờ: {now}',
  shortcuts: 'Lối tắt',
  stats: 'Chỉ số',
  merit: '{n} công đức',
  bestCombo: 'Combo cao nhất {n}',
  soon: 'Sắp có',
  picked: 'Đã chọn: {what}',
  unsupportedTitle: 'Máy này chưa mở được sân chùa 3D',
  unsupportedBody: 'Thử Chrome, Edge hoặc Safari bản mới, hoặc dùng bản thường.',
  unsupportedLink: 'Về bản thường',
  'preset.sunset': 'hoàng hôn',
  'preset.lanternNight': 'đêm đèn lồng',
  'preset.mistyMorning': 'sáng sương',
  'action.incense': 'Thắp hương',
  'action.beat': 'Mõ Beat',
  'action.endless': 'Mõ vô cực',
  'action.sutra': 'Tụng kinh',
  'action.bell': 'Nghe chuông',
  'action.bowl': 'Nghe bát',
  'action.journal': 'Sổ',
  'action.radio': 'Đài',
  'action.strike': 'Gõ mõ',
  'prop.censer': 'Lư hương',
  'prop.sutraShelf': 'Giá kinh',
  'prop.mo': 'Mõ',
  'prop.bell': 'Chuông',
  'prop.bowl': 'Bát',
  'prop.woodenBoard': 'Bảng gỗ',
} as const;

export type HudKey = keyof typeof vi;

const en: Record<HudKey, string> = {
  canvas: '3D temple yard: tap the incense burner, the sutra stand, the wooden fish, the bell, the bowl or the board',
  loading: 'Opening the temple gate',
  start: 'Start',
  info: 'About and promises',
  close: 'Close',
  soundOff: 'Mute',
  soundOn: 'Unmute',
  timeOfDay: 'Change the time of day: {now}',
  shortcuts: 'Shortcuts',
  stats: 'Stats',
  merit: '{n} merit',
  bestCombo: 'Best combo {n}',
  soon: 'Coming soon',
  picked: 'Picked: {what}',
  unsupportedTitle: 'This device cannot open the 3D yard yet',
  unsupportedBody: 'Try a recent Chrome, Edge or Safari, or use the classic version.',
  unsupportedLink: 'Classic version',
  'preset.sunset': 'sunset',
  'preset.lanternNight': 'lantern night',
  'preset.mistyMorning': 'misty morning',
  'action.incense': 'Light incense',
  'action.beat': 'Mõ Beat',
  'action.endless': 'Endless mõ',
  'action.sutra': 'Chant',
  'action.bell': 'Ring the bell',
  'action.bowl': 'Sound the bowl',
  'action.journal': 'Journal',
  'action.radio': 'Radio',
  'action.strike': 'Strike the wooden fish',
  'prop.censer': 'Incense burner',
  'prop.sutraShelf': 'Sutra stand',
  'prop.mo': 'Wooden fish',
  'prop.bell': 'Bell',
  'prop.bowl': 'Singing bowl',
  'prop.woodenBoard': 'Wooden board',
};

export type HudText = (key: HudKey, vars?: Record<string, string | number>) => string;

export function useHudText(): HudText {
  const { locale } = useI18n();
  return useCallback((key, vars) => format(locale === 'en' ? en[key] : vi[key], vars), [locale]);
}

export const actionKey = (action: WorldAction): HudKey => `action.${action}`;
export const propKey = (prop: InteractivePropId): HudKey => `prop.${prop}`;
export const presetKey = (preset: LightingPresetId): HudKey => `preset.${preset}`;
