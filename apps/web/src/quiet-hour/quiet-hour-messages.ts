/** Words of the "Giờ Tĩnh" chip (Vietnamese and English). */
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

export const useQuietHourText = createFeatureText(vi, en);
