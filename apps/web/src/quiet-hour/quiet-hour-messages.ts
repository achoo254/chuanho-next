/** Words of the "Giờ Tĩnh" chip (Vietnamese, English and Simplified Chinese). */
import { createFeatureText } from '../features/feature-text';

const vi = {
  name: 'Giờ Tĩnh',
  before: 'Giờ Tĩnh {time} · còn {n} phút',
  open: 'Giờ Tĩnh · {total} nhịp · còn {n} phút',
  after: 'Giờ Tĩnh tối nay · {total} nhịp',
  about: 'Mỗi tối {time}, mọi người cùng gõ mõ nửa tiếng. Nhịp gõ ở Mõ vô cực cộng vào tổng chung.',
  guestHint: 'Đăng nhập để nhịp của bạn được cộng vào tổng chung.',
  milestones: 'Đã đạt {n} mốc chung',
} as const;

const en: Record<keyof typeof vi, string> = {
  name: 'Quiet Hour',
  before: 'Quiet Hour {time} · in {n} min',
  open: 'Quiet Hour · {total} strokes · {n} min left',
  after: 'Tonight’s Quiet Hour · {total} strokes',
  about: 'Every evening at {time}, everyone strikes the wooden fish together for half an hour. Strokes in Endless mõ add to the shared count.',
  guestHint: 'Sign in so your strokes join the shared count.',
  milestones: '{n} shared milestones reached',
};

const zhCN: Record<keyof typeof vi, string> = {
  name: '静心时刻',
  before: '静心时刻 {time} · 还有 {n} 分钟',
  open: '静心时刻 · {total} 声 · 剩 {n} 分钟',
  after: '今晚的静心时刻 · {total} 声',
  about: '每晚 {time}，大家一起敲木鱼半小时。在无尽木鱼里敲的每一声都会计入共同总数。',
  guestHint: '登录后，你敲的木鱼声才会计入共同总数。',
  milestones: '已达成 {n} 个共同里程碑',
};

export const useQuietHourText = createFeatureText(vi, en, zhCN);
