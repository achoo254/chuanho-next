/** UI strings in Vietnamese (default) and English. `{app}` is replaced by the brand name. */
export const vi = {
  'layout.skip': 'Bỏ qua tới nội dung',
  'layout.ecosystem': 'Một app của {domain}',
  'layout.disclaimer': 'Chỉ để giải trí và thư giãn, không thay cho việc đi chùa thật.',
  'intro.title': 'Ghé {app} vài phút cho tâm bớt lag',
  'intro.lead': 'Gõ mõ theo nhịp, thắp nén hương, check-in khẩu nghiệp rồi bật Lofi {app}. Không ai phán xét, chỉ có bạn và tiếng mõ.',
  'intro.pledgeLabel': 'Cam kết của {app}',
  'intro.pledge.noAds': 'Không quảng cáo',
  'intro.pledge.noBegging': 'Không xin tiền',
  'intro.pledge.noLuck': 'Không bán đổi vận',
  'intro.pledge.noVirtualGifts': 'Không quà ảo quy đổi',
  'intro.pledge.notTemple': 'Không thay đi chùa thật',
  'intro.start': 'Bắt đầu',
  'intro.comingSoon': 'Sân chùa đang được dựng. Quay lại sớm nhé!',
} as const;

export type MessageKey = keyof typeof vi;
export type Messages = Record<MessageKey, string>;

export const en: Messages = {
  'layout.skip': 'Skip to content',
  'layout.ecosystem': 'An app from {domain}',
  'layout.disclaimer': 'Just for fun and calm; no substitute for visiting a real temple.',
  'intro.title': 'A few minutes at {app} to reset your mind',
  'intro.lead': 'Tap the wooden bell to the beat, light incense, check in on harsh words, then play Lofi. No judging, just you and the beat.',
  'intro.pledgeLabel': '{app} promises',
  'intro.pledge.noAds': 'No ads',
  'intro.pledge.noBegging': 'No asking for money',
  'intro.pledge.noLuck': 'No selling luck',
  'intro.pledge.noVirtualGifts': 'No cash-out virtual gifts',
  'intro.pledge.notTemple': 'No substitute for a real temple',
  'intro.start': 'Start',
  'intro.comingSoon': 'The temple yard is being built. Come back soon!',
};
