/**
 * The words of the "Xin xăm" screen in both languages. The quẻ themselves (name, verse, meaning, today's message) stay
 * Vietnamese in both: lục bát does not translate. The honest "this is for fun" line reuses the app's main disclaimer
 * (`layout.disclaimer` in i18n/messages.ts) and only adds what is particular to drawing a stick.
 */
import { createFeatureText } from '../feature-text';

const vi = {
  title: 'Xin xăm',
  intro: 'Lắc ống xăm, một que rơi ra, đọc lá xăm của hôm nay. Mỗi ngày một quẻ thôi nha.',
  notAdvice: 'Lá xăm là thơ tự viết cho vui, không phải bói toán hay lời khuyên. Quyết định vẫn là của bạn.',
  loading: 'Đang mở ống xăm…',
  failed: 'Chưa tải được ống xăm. Kiểm tra mạng rồi thử lại nhé.',
  retry: 'Thử lại',
  shake: 'Lắc ống xăm',
  shakeHint: 'Bấm nút, nhấn Space hoặc lắc nhẹ điện thoại.',
  shaking: 'Đang lắc…',
  reshow: 'Xem lại lá xăm hôm nay',
  alreadyToday: 'Hôm nay bạn đã xin rồi, đây vẫn là quẻ của bạn. Mai quay lại xin quẻ mới nha.',
  tube: 'Ống xăm',
  stickLabel: 'Que số {n}',
  cardLabel: 'Lá xăm hôm nay',
  meaning: 'Ý nghĩa',
  today: 'Lời nhắn hôm nay',
  copy: 'Chép',
  copied: 'Đã chép',
  copyFailed: 'Chưa chép được, bạn bôi đen lá xăm để chép tay nhé.',
  share: 'Chia sẻ',
  shareFooter: 'Xin xăm cho vui ở {app}',
  again: 'Xem ống xăm',
};

const en: Record<keyof typeof vi, string> = {
  title: 'Draw a fortune',
  intro: 'Shake the stick tube, one stick falls out, read today’s slip. One per day.',
  notAdvice: 'The slips are self-written poems for fun, not fortune telling or advice. Your choices stay yours.',
  loading: 'Opening the stick tube…',
  failed: 'Could not load the stick tube. Check your connection and try again.',
  retry: 'Try again',
  shake: 'Shake the tube',
  shakeHint: 'Press the button, hit Space or give your phone a gentle shake.',
  shaking: 'Shaking…',
  reshow: 'See today’s slip again',
  alreadyToday: 'You already drew today; this is still your slip. Come back tomorrow for a new one.',
  tube: 'Stick tube',
  stickLabel: 'Stick no. {n}',
  cardLabel: 'Today’s slip (in Vietnamese)',
  meaning: 'Meaning',
  today: 'For today',
  copy: 'Copy',
  copied: 'Copied',
  copyFailed: 'Could not copy; select the slip to copy it by hand.',
  share: 'Share',
  shareFooter: 'Drawn for fun at {app}',
  again: 'Back to the tube',
};

export const useFortuneText = createFeatureText(vi, en);
