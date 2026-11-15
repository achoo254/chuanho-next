/**
 * What Tiểu Đệ, the little novice of the yard, says (Vietnamese and English), plus the few words around the chip.
 * Each `line.*` key is one entry of the bank in tieude-lines.ts; a new line needs both a key here and an entry there
 * (a test checks they match). House rules for every line: gentle and short, about the player's body, breath, rest or
 * the yard's own tools; never money, donations, sharing, buying, guilt or streaks.
 */
import { createFeatureText } from '../feature-text';

const vi = {
  name: 'Tiểu Đệ',
  label: 'Tiểu Đệ nhắc nhẹ',
  dismiss: 'Ẩn lời nhắc',
  silence: 'Hôm nay đừng nhắc nữa',
  'line.water': 'Ê, uống miếng nước đi, não cũng cần được tưới nha.',
  'line.water2': 'Chai nước để đó nãy giờ hơi tủi thân rồi á.',
  'line.breath': 'Hít vào bốn nhịp, thở ra sáu nhịp. Xong một lần thiền mini rồi đó.',
  'line.jaw': 'Thả lỏng hàm ra chút nè, nãy giờ cắn răng hơi kỹ đó.',
  'line.shoulders': 'Hạ vai xuống, xoay vai ba vòng. Vai đâu phải móc treo stress.',
  'line.neck': 'Nghiêng đầu trái phải nhẹ nhẹ, cổ cảm ơn bạn liền.',
  'line.eyes': 'Nhìn ra xa chừng hai mươi giây cho mắt nghỉ xíu nha.',
  'line.mo': 'Gõ một tiếng mõ cho nhẹ lòng nè. Cốc.',
  'line.mo2': 'Không cần gõ đủ nhịp đâu, một tiếng mõ cũng đủ dễ thương rồi.',
  'line.bell': 'Thử thỉnh chuông một cái, nghe ngân cho tâm bớt lag.',
  'line.incense': 'Thắp một nén hương rồi ngồi nhìn khói bay cũng chill lắm đó.',
  'line.journal': 'Lỡ nói câu nào hơi nặng hôm nay? Ghé Sổ ghi một dòng thôi, không ai chấm điểm đâu.',
  'line.journal2': 'Nhịn được một câu khó chịu cũng đáng ghi vào Sổ đó, tự hào chút đi.',
  'line.radio': 'Cần tập trung? Bật Đài lên, mình giữ sân yên cho bạn làm việc.',
  'line.gentle': 'Định nhắn câu gắt hả? Thử Dịch sang tiếng hiền trước nha.',
  'line.fortune': 'Hôm nay xin lá xăm chưa? Đọc cho vui thôi nha.',
  'line.kind': 'Bạn đang làm tốt hơn bạn nghĩ đó. Thiệt.',
  'line.slow': 'Chậm lại một nhịp cũng được mà, mọi thứ vẫn chờ bạn.',
  'line.rest': 'Mệt thì nghỉ, không sao hết. Sân chùa vẫn ở đây mà.',
  'line.posture': 'Ngồi thẳng lưng lên xíu, đừng để cột sống thành dấu hỏi nha.',
  'line.snack': 'Đói thì ăn chút gì nhẹ nhẹ, đừng để bụng kêu to hơn mõ.',
  'line.sky': 'Nhìn mây trôi chút đi, trời hôm nay cũng đang cố gắng như bạn.',
  'line.screen': 'Rời màn hình một phút, nhìn quanh phòng thử xem.',
  'line.gratitude': 'Nghĩ tới một điều nhỏ làm bạn vui hôm nay. Có rồi đúng không?',
  'line.merit': 'Hôm nay bạn gom được {merit} công đức rồi đó, sân chùa sáng hẳn lên.',
  'line.merit2': '{merit} công đức hôm nay, không để khoe, mà nhìn cũng vui ha.',
  'line.merit3': 'Cảm ơn bạn ghé gõ mõ hôm nay nha. {merit} công đức, sân đẹp ghê.',
  'line.morning': 'Chào buổi sáng! Uống ly nước ấm trước cà phê nha.',
  'line.morning2': 'Sáng nay chọn một việc chính thôi, làm xong là thắng rồi.',
  'line.morning3': 'Mở cửa sổ hít chút gió sáng đi, miễn phí mà.',
  'line.evening': 'Chiều rồi, đứng dậy vươn vai cho hết một ngày ngồi.',
  'line.evening2': 'Hôm nay vất vả rồi, tự vỗ vai mình một cái nha.',
  'line.evening3': 'Ăn tối đàng hoàng nha, đừng ăn vội trước màn hình.',
  'line.night': 'Khuya rồi đó, ngủ sớm chút mai dậy tươi hơn nè.',
  'line.night2': 'Để điện thoại xa giường chút, giấc ngủ sẽ cảm ơn bạn.',
  'line.night3': 'Bật Đài chế độ ngủ rồi nhắm mắt đi, mình canh sân cho.',
};

const en: Record<keyof typeof vi, string> = {
  name: 'Tiểu Đệ',
  label: 'A gentle nudge from Tiểu Đệ',
  dismiss: 'Hide the nudge',
  silence: 'No more nudges today',
  'line.water': 'Hey, sip some water. Brains need watering too.',
  'line.water2': 'Your water bottle is feeling a little ignored.',
  'line.breath': 'Breathe in for four, out for six. That was a mini meditation.',
  'line.jaw': 'Unclench your jaw a bit; it has been working hard.',
  'line.shoulders': 'Drop your shoulders and roll them three times. They are not a stress hanger.',
  'line.neck': 'Tilt your head left and right, gently. Your neck says thanks.',
  'line.eyes': 'Look at something far away for twenty seconds. Eyes need a break too.',
  'line.mo': 'Tap the wooden fish once, just to feel lighter. Tok.',
  'line.mo2': 'No need for a full round; one tok is cute enough.',
  'line.bell': 'Ring the bell once and let the hum calm your mind.',
  'line.incense': 'Light an incense stick and watch the smoke drift. Very chill.',
  'line.journal': 'Said something a bit harsh today? One line in the Journal; nobody is grading.',
  'line.journal2': 'Holding back one snappy reply is worth a Journal line. Be a little proud.',
  'line.radio': 'Need to focus? Turn on the Radio; I will keep the yard quiet.',
  'line.gentle': 'About to send a sharp text? Try Say it gently first.',
  'line.fortune': 'Drawn today’s slip yet? It is just for fun.',
  'line.kind': 'You are doing better than you think. For real.',
  'line.slow': 'It is okay to slow down a beat; things will wait for you.',
  'line.rest': 'Tired? Rest. That is fine. The yard will still be here.',
  'line.posture': 'Sit up a little; do not let your spine become a question mark.',
  'line.snack': 'Hungry? Grab something light before your stomach out-drums the wooden fish.',
  'line.sky': 'Watch the clouds for a bit; the sky is trying its best today too.',
  'line.screen': 'Look away from the screen for a minute and glance around the room.',
  'line.gratitude': 'Think of one small thing that made you smile today. Got one?',
  'line.merit': 'You gathered {merit} merit today; the yard looks brighter.',
  'line.merit2': '{merit} merit today. Not for showing off, but nice to see, right?',
  'line.merit3': 'Thanks for drumming today. {merit} merit, and the yard looks lovely.',
  'line.morning': 'Good morning! A glass of warm water before the coffee.',
  'line.morning2': 'Pick just one main task this morning; finish it and you win.',
  'line.morning3': 'Open a window and breathe some morning air; it is free.',
  'line.evening': 'Evening already. Stand up and stretch out a day of sitting.',
  'line.evening2': 'Long day. Give yourself a pat on the shoulder.',
  'line.evening3': 'Have a proper dinner, not a rushed one in front of a screen.',
  'line.night': 'It is late; an earlier night means a fresher morning.',
  'line.night2': 'Put the phone a little away from the bed; your sleep will thank you.',
  'line.night3': 'Put the Radio on sleep mode and close your eyes; I will watch the yard.',
};

export type TieuDeTextKey = keyof typeof vi;

/** Both dictionaries, for the test that checks every line of the bank has words. */
export const TIEUDE_TEXT: Readonly<Record<'vi' | 'en', Readonly<Record<TieuDeTextKey, string>>>> = { vi, en };

export const useTieuDeText = createFeatureText(vi, en);
