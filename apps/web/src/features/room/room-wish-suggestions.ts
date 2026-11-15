/**
 * Quick wish suggestions per room theme, written ahead of time in the voice of the room (Gen-Z Vietnamese, light and
 * kind). Static: nothing is fetched. Every line passes the same wish filter as a typed one (room-wish-suggestions.test.ts).
 */
import type { RoomTheme } from '@chuanho/contract';

export const ROOM_WISH_SUGGESTIONS: Readonly<Record<RoomTheme, readonly string[]>> = {
  deadline: [
    'Deadline lùi thêm một tuần nha vũ trụ',
    'Code chạy một lần là pass luôn',
    'Bug tự biến mất trước giờ demo',
    'Merge không conflict, deploy không toang',
    'Sếp duyệt ngay bản đầu tiên',
    'Production yên bình, không ai gọi lúc nửa đêm',
    'Test xanh hết, review nhẹ tay',
  ],
  overtime: [
    'Hôm nay về đúng giờ, không ai nhắn việc',
    'OT ít thôi, ngủ đủ 8 tiếng',
    'Tăng ca thì tăng luôn lương nha',
    'Cuối tuần được nghỉ trọn vẹn',
    'Laptop không sập lúc 11 giờ đêm',
    'Xong việc sớm còn kịp đi ăn lẩu',
  ],
  exam: [
    'Đề trúng tủ, câu nào cũng biết',
    'Qua môn nhẹ nhàng, không phải học lại',
    'Thầy cô chấm thoáng tay nha',
    'Học đâu nhớ đó, vào phòng thi không quên',
    'GPA lên xanh, ba mẹ vui',
    'Ngủ đủ giấc trước hôm thi',
  ],
  meeting: [
    'Họp 5 phút thôi, không phát sinh',
    'Cuộc họp này lẽ ra chỉ là một tin nhắn',
    'Không ai hỏi câu khó lúc mình share màn hình',
    'Mic tắt đúng lúc, camera không lag',
    'Họp xong không có thêm task mới',
    'Chiều nay lịch trống để làm việc thật',
  ],
  love: [
    'Crush rep tin nhắn trong 5 phút',
    'Năm nay thoát ế nhẹ nhàng',
    'Người thương bớt giận, mình bớt lầy',
    'Gặp được người hợp vibe',
    'Hết cảnh seen không rep rồi nha',
    'Thương ai cũng được thương lại gấp đôi',
  ],
  custom: [
    'Cả phòng bình an, bớt drama',
    'Tâm bớt lag, việc bớt toang',
    'Năm nay nhẹ nhàng mà vẫn ổn',
    'Ai cũng khỏe, ai cũng vui',
    'Ngủ ngon, ăn ngon, sống chill',
    'Mọi chuyện rồi sẽ ổn thôi',
  ],
};
