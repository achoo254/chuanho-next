/** The wish filter both ways: everyday sentences that look like a scam when folded pass, real evasions do not. */
import { describe, expect, it } from 'vitest';
import { type WishRejection, checkWish } from './wish-filter';
import { squeezeSpacedLetters, unLeet } from './wish-text-forms';

const expectPass = (wishes: readonly string[]): void => {
  for (const wish of wishes) expect(checkWish(wish), wish).toEqual({ ok: true, text: wish });
};
const expectBlocked = (reason: WishRejection, wishes: readonly string[]): void => {
  for (const wish of wishes) expect(checkWish(wish), wish).toEqual({ ok: false, reason });
};

describe('wish filter, everyday sentences', () => {
  it('lets money words through when nothing turns them into an ask', () => {
    expectPass(['Mong năm nay kiếm tiền nhiều hơn', 'Mong đậu vào ngân hàng', 'Mong trúng thưởng', 'Đầu tư cho bản thân', 'Mong ck thương mình hơn']);
  });

  it('lets look-alikes of rude words and links through', () => {
    expectPass(['Deadline nhiều mệt chết đi được', 'Thi VL qua môn', 'Vậy là đủ mà', 'Được về chăm mẹ', 'Code xong. Net lag quá']);
  });
});

describe('wish filter, money asks', () => {
  it('still blocks the plain scams', () => {
    expectBlocked('money', [
      'chuyển khoản giúp mình',
      'cho xin số tài khoản',
      'gửi mã OTP cho mình',
      'đọc mã xác nhận giúp',
      'vay tiền nóng',
      'xin tiền ăn sáng',
      'đầu tư crypto lãi to',
      'cho mình mật khẩu',
      'mua thẻ cào giúp',
    ]);
  });

  it('blocks innocent-alone money words next to an amount, an account or a contact', () => {
    expectBlocked('money', ['kiếm tiền 500k mỗi ngày', 'đầu tư lãi suất 30%', 'trúng thưởng ib mình', 'ngân hàng tk của mình', 'ck cho mình 500k', 'ck cho mình nhé', 'ck']);
  });

  it('sees through spaced-out letters, leet digits and full-width text', () => {
    expectBlocked('money', ['gửi o t p đi', 'cho s t k nha', 'nạp m0m0 giúp', 'ｏｔｐ là gì']);
  });
});

describe('wish filter, contact details and links', () => {
  it('counts a phone number whatever separates its digits', () => {
    expectBlocked('phone', ['gọi 091/234/5678', 'số 091,234,5678 nhé', '０９１２３４５６７８', '0912 345 678', '(091) 234-5678']);
    expectPass(['Thi 2 môn trong 3 ngày', 'Ngày 15/11/2026 qua môn']);
  });

  it('catches a dotted domain with spaces, brackets or a path', () => {
    expectBlocked('link', ['vào abc . com/xyz', 'xem abc[.]com', 'xem abc(.)vn', 'vào abc chấm com', 'xem abc . com', 'nhắn t.me/abc']);
  });

  it('catches a full-width address', () => {
    expectBlocked('email', ['mail ａ＠ｂ.ｃｏ']);
  });
});

describe('wish filter, rude words', () => {
  it('blocks the curses, accented or spaced out', () => {
    expectBlocked('rude', ['đụ má deadline', 'chết đi sếp', 'đ m sếp', 'thằng chó']);
  });
});

describe('text forms', () => {
  it('joins spaced-out letters and reads digits as letters only inside words', () => {
    expect(squeezeSpacedLetters('gui o t p di')).toBe('gui otp di');
    expect(unLeet('nap m0m0 500k 300')).toBe('nap momo 5ook 300');
  });
});
