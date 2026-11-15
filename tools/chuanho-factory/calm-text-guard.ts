/**
 * Words that must never appear in factory text (verses read aloud, video titles, tags, burned-in subtitles).
 * Videos for Tiểu Đệ are "chỉ nhạc và hình, không kêu gọi ủng hộ": no donation asks, calls to action, links or
 * QR codes; the verses make no religious claims and promise no luck.
 */

const FORBIDDEN: readonly { readonly phrase: string; readonly why: string }[] = [
  // donation asks and money
  ...['ủng hộ', 'donate', 'quyên góp', 'chuyển khoản', 'số tài khoản', 'stk', 'momo', 'công đức tiền', 'cúng dường'].map((phrase) => ({ phrase, why: 'donation ask' })),
  // calls to action and links
  ...['theo dõi', 'follow', 'đăng ký', 'subscribe', 'like', 'thả tim', 'chia sẻ', 'share', 'bình luận', 'comment', 'bấm vào', 'nhấn vào', 'link', 'liên kết', 'qr', 'mua ngay', 'tải app', 'tải ứng dụng', 'inbox'].map(
    (phrase) => ({ phrase, why: 'call to action' }),
  ),
  // promises of luck and religious claims
  ...['may mắn', 'phát tài', 'tài lộc', 'giàu', 'trúng', 'đổi vận', 'giải hạn', 'tiêu tai', 'linh ứng', 'linh nghiệm', 'cầu được ước thấy', 'phù hộ', 'gia hộ', 'độ trì', 'khỏi bệnh', 'chữa bệnh', 'tiêu nghiệp'].map(
    (phrase) => ({ phrase, why: 'promise of luck or religious claim' }),
  ),
];

const URL_LIKE = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|vn|net|org|io|me|app|link)\b|@[a-z0-9_.]{2,})/iu;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const PATTERNS = FORBIDDEN.map(({ phrase, why }) => ({
  phrase,
  why,
  // Whole words only, so "like" does not match inside another word; Vietnamese letters count as letters.
  re: new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(phrase.normalize('NFC'))}(?![\\p{L}\\p{N}])`, 'iu'),
}));

/** Every reason the text breaks the rules; empty when it is calm. */
export function calmTextProblems(text: string): string[] {
  const normal = text.normalize('NFC');
  const problems = PATTERNS.filter(({ re }) => re.test(normal)).map(({ phrase, why }) => `"${phrase}" (${why})`);
  if (URL_LIKE.test(normal)) problems.push('looks like a link or handle');
  return problems;
}
