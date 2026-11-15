# Âm thanh

Mọi âm thanh của game do mô hình AI chạy offline trên máy của chủ dự án tạo ra (ACE-Step 1.5, giấy phép MIT, qua
ComfyUI), rồi cắt và chuẩn hóa bằng ffmpeg và numpy. Không có mẫu nào chép từ nguồn ngoài. Công cụ tạo và tiêu chí
chọn nằm ở `tools/chuanho-music` của workspace `hoandat-app` (`generate_sfx.py`, `slice_sfx.py`).

## Hiệu ứng (trong thư mục này)

Mỗi nhóm có nhiều take; game phát ngẫu nhiên một take, không lặp take vừa phát, lệch cao độ ±3 % và âm lượng khoảng
±1 dB (`SOUND_GROUPS` trong `src/audio/audio-engine.ts`). Mỗi take là một cú đánh tách riêng, chọn tự động trong các
đoạn 30 giây sinh từ nhiều prompt và seed, sao cho các take khác nhau nhiều nhất về cao độ, độ sáng và độ ngân.

| Tệp | Nguồn |
|---|---|
| `mo-01.wav` … `mo-14.wav` | Tiếng mõ (WAV 32 kHz, giữ đúng nhịp): các prompt "wooden fish / muyu / temple block" lớn, nhỏ, gỗ trầm, gỗ sáng (seed 2, 4, 5) |
| `bell-01.mp3` … `bell-07.mp3` | Chuông đồng và chiêng chùa: "large bronze temple bell", "chinese temple gong", "bronze bell struck with a wooden beam", "small bronze temple bell" (seed 11–14) |
| `bowl-01.mp3` … `bowl-05.mp3` | Bát đồng (singing bowl) lớn, nhỏ, pha lê, bát chuông trầm (seed 21–28) |
| `chime-01.mp3` … `chime-03.mp3` | Chuông nhỏ, chuông tay, tingsha cho lúc thắp hương và tụng kinh (seed 31–36) |
| `pad-loop.mp3` | Nhạc nền dự phòng không lời phong cách Trung Hoa (sáo trúc, đàn tranh, nhị hồ, chuông), 67 giây, đuôi nối chồng vào đầu để lặp không thấy mối (seed 33); phát khi không tải được thư viện nhạc |
| `pulse.wav` | Một tiếng trống nhịp mềm cắt từ đoạn lofi (seed 5), dùng làm nhịp cho Mõ Beat |

Tiếng lật trang đã thử nhưng ACE-Step là mô hình nhạc, ra tiếng gõ đều chứ không ra tiếng giấy, nên không dùng.

## Thư viện nhạc nền (trên máy chủ, `/media/music/`)

Khoảng 4,2 giờ nhạc không lời phong cách Trung Hoa (sáo trúc dizi/xiao/hulusi, đàn tranh, cổ cầm, tỳ bà, dương cầm, nhị
hồ, chuông chùa, bát, chiêng), mỗi bài 1,5–3 phút, tạo bằng ACE-Step 1.5 với prompt thay đổi có hệ thống (nhạc cụ, cảnh và
tâm trạng, tempo 50–66, giọng/điệu, seed). Không nằm trong repo: tải lên máy chủ bằng `infra/upload-music.sh`, danh sách
bài, độ dài, seed và prompt nằm trong `manifest.json` cạnh các bài. Chất lượng chỉ được chọn bằng kiểm tra khách quan (im
lặng, vỡ tiếng, tiếng ồn, trống/nhịp dẫn, bản gần trùng); tai người chưa duyệt từng bài.

Giấy phép: AI-generated for the hoandat ecosystem; owned by hoandat, all rights reserved.
