# Giọng đọc kinh

Giọng đọc trong chế độ Tụng kinh do mô hình AI chạy offline trên máy của chủ dự án đọc ra (VieNeu-TTS v3 Turbo,
giấy phép Apache-2.0, giọng có sẵn của mô hình "Thiền Tâm Đức"; không nhân bản giọng người thật), rồi xử lý bằng
ffmpeg: cắt khoảng lặng, đọc chậm lại (atempo 0,82), lọc dải tiếng nói, thêm chút vang nhẹ như trong chánh điện, chuẩn
hóa âm lượng (EBU R128, -18 LUFS), xuất MP3 đơn kênh 64 kbps.

Lời đọc là đúng nguyên văn các dòng trong `apps/web/src/game/sutra-text.ts` (trích Bát Nhã Tâm Kinh, rồi niệm Nam mô
A Di Đà Phật). Mỗi dòng trên màn hình một tệp; `manifest.json` ghi tệp, độ dài và điểm nhận dạng giọng nói (ASR) của
từng dòng. Công cụ tạo lại: `tools/chuanho-voice/` trong repo workspace (`generate-sutra-voice.py`, `asr-check.py`).

| Tệp | Nội dung |
|---|---|
| `line-01.mp3` .. `line-11.mp3` | Mười một dòng trích Bát Nhã Tâm Kinh |
| `nam-mo-1.mp3` .. `nam-mo-3.mp3` | Ba lần niệm "Nam mô A Di Đà Phật", mỗi lần một bản đọc khác nhau |

Giấy phép: AI-generated for the hoandat ecosystem; owned by hoandat, all rights reserved.
