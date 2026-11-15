# chuanho-factory

Nhà máy sản xuất của Chùa Nhỏ trên PC: hàng đợi việc bền (nhạc nền, tranh nền theo buổi, giọng đọc bài kệ, video cho
Tiểu Đệ, beatmap, gói thư viện để tải lên), chạy khi PC rảnh và nhường GPU, kiểm chất lượng khách quan, loại bản không
đạt. Chỉ dùng Node 22 + `tsx` của repo, `ffmpeg`/`ffprobe` trên PATH và các công cụ có sẵn (không viết lại):

| Việc | Công cụ dùng lại |
|---|---|
| Nhạc nền, kiểm nhạc | `tools/chuanho-music/generate_music.py`, `qc_music.py` (workspace `hoandat-app`) |
| Tranh nền | skill `inet-artgen`: `artgen.py -w qwen` |
| Giọng đọc, ASR | `inet-artgen/voice.py`, `tools/chuanho-voice/asr-check.py` |
| Beatmap | `tools/chuanho-beatmap/cli.ts` (repo này) |
| Tải lên | `infra/upload-music.sh` (người vận hành chạy, nhà máy chỉ in lệnh) |

## Chạy

```sh
T="pnpm exec tsx tools/chuanho-factory/cli.ts"
$T plan-night                       # xếp mẻ đêm: nhạc 8 bản, beatmap, tranh, giọng, 2 video 30 s, gói thư viện
$T enqueue music --count 8          # hoặc: scene --times night | verse-voice | video --seconds 45 --time evening [--no-voice] | beatmap | publish-library
$T run                              # chạy hết hàng đợi trong khung giờ cho phép, nhường GPU; Ctrl+C dừng sau bước đang chạy, Ctrl+C lần hai dừng ngay
$T run --dry-run                    # xem cổng (khung giờ, GPU, hàng đợi ComfyUI, --health) và việc kế tiếp, không đổi gì
$T run --once --ignore-window       # chạy đúng một việc ngay (vẫn nhường GPU, vẫn cần --health)
$T list [--status failed] [--all]   # và: status, requeue <jobId>, verses (kiểm verses.json)
$T reject m012 --reason "chói"      # gỡ bản
```

Chạy mỗi đêm: Task Scheduler của Windows gọi `plan-night` rồi `run` lúc 23:00 (thư mục làm việc là `chuanho-next`).
`run` chờ tới khi khung giờ mở, tự thoát khi hết việc; hai `run` cùng lúc thì cái sau từ chối (khoá `runner.lock`).

## Cấu hình (ngoài git)

Thư mục trạng thái: `CHUANHO_FACTORY_HOME`, mặc định `%APPDATA%/chuanho-factory` (Windows) hoặc
`~/.config/chuanho-factory`. Trong đó: `queue.jsonl` (hàng đợi), `runner.lock`, `config.json` (tuỳ chọn), `media/`.
Địa chỉ ComfyUI tra như artgen: `ARTGEN_URL`, rồi `~/.config/inet-artgen/env`, rồi máy cục bộ. Không ghi địa chỉ máy,
tên máy hay bí mật vào repo.

Khoá của `config.json` (đều tuỳ chọn): `mediaDir` (hoặc env `CHUANHO_FACTORY_MEDIA`), `window` (`"23:00-07:00"`),
`gpuBusyPercent`, `gpuBusySamples`, `gpuMinFreeMiB` (0 = tắt), `sampleSeconds`, `minPauseSeconds`, `maxPauseSeconds`,
`maxAttempts`, `python`, `asrPython` (hoặc env `ASR_PYTHON`; venv có faster-whisper, thiếu thì việc giọng đọc báo lỗi),
`artgenDir`, `musicToolDir`, `voiceToolDir`, `fontFile`, `libraryHours`, `libraryKbps`, `verseVoice`, `publicUrl`,
`libraryEnvFile` (file env có `LIBRARY_ADMIN_TOKEN`; chỉ dùng đường dẫn, không đọc hay in giá trị).

Thư mục `media/`: `music-raw/` (bản thô, `jobs.jsonl`, `qc-report.json`), `library/` (thư viện đã kiểm, `manifest.json`,
`beatmaps/`), `scenes/`, `voices/`, `videos/` (bàn giao cho Tiểu Đệ), `publish/library/` (gói để tải lên), `work/`.

## Hàng đợi

Mỗi việc có trạng thái `pending` → `running` → `passed` (có ít nhất một sản phẩm đạt) / `rejected` (không sản phẩm nào
đạt) / `failed` (lỗi đủ số lần thử, mặc định 3; lần thử lại cách 2, 4, 8 … phút). Mỗi thay đổi là một dòng JSON trong
`queue.jsonl`, dòng sau cùng của một việc là trạng thái hiện tại; dòng hỏng do mất điện bị bỏ qua. Việc đang chạy khi
máy tắt đột ngột được tính là một lần thử hỏng; việc bị Ctrl+C trả về `pending` mà không tính lần thử. Thứ tự: nhạc,
beatmap, tranh, giọng, video, gói thư viện.

## Chạy khi rảnh, nhường GPU

Trước mỗi việc và trước mỗi bước dùng GPU (một bản nhạc, một tranh, một lần đọc), runner hỏi cổng (`idle-gate.ts`, hàm
thuần): ngoài khung giờ thì ngủ tới giờ mở; `nvidia-smi` báo bận hơn `gpuBusyPercent` thì đợi một nhịp lấy mẫu, bận
`gpuBusySamples` lần liền thì coi là phiên khác đang dùng và tạm dừng, thời gian chờ nhân đôi tới `maxPauseSeconds`;
hàng đợi ComfyUI (`/queue`) có việc khi runner đang ở giữa hai bước thì đó là việc của phiên khác, tạm dừng; cuối cùng
`artgen.py --health` phải `ok` (kết quả tốt giữ 5 phút). Một vòng lặp, một việc một lúc, cộng khoá file giữa các tiến
trình. Runner chỉ dừng tiến trình con chính nó mở; prompt đã gửi vào ComfyUI thì ComfyUI vẫn chạy nốt.

## Kiểm chất lượng (không ai nghe thay chủ dự án)

- Nhạc: `qc_music.py` (lặng, ngắn, vỡ tiếng, ồn, có trống, lặp gần trùng, đủ giờ); nhà máy đọc `qc-report.json` thành
  kết quả từng bản. Bản bị loại không vào `manifest.json`, nên không bao giờ vào gói tải lên.
- Tranh: đúng khổ 9:16, file không rỗng, dải sáng đủ rộng (`signalstats`); bản hỏng bị xoá. Không đo được việc model
  lén vẽ chữ: prompt và negative prompt cấm chữ, thấy thì gỡ tay.
- Giọng: ASR `asr-check.py` từ 0,8 trở lên, độ dài 1–20 s, −24 đến −14 LUFS, đỉnh dưới −1 dBTP, không lặng quá 1,2 s.
- Video: 1080×1920, đúng độ dài ±0,5 s, −20 đến −12 LUFS, không lặng quá 3 s, chữ hiển thị qua bộ lọc lời êm
  (`calm-text-guard.ts`: không xin ủng hộ, không kêu gọi theo dõi hay bấm link, không đường dẫn, không hứa may mắn).

## Bài kệ (`verses.json`)

Claude viết; PC chỉ đọc. Mười hai câu ngắn, êm, không phải kinh, không hứa may mắn, số viết bằng chữ, mỗi câu gắn một
buổi hoặc `any`. Sửa xong chạy `$T verses` (và test) để kiểm.

## Video cho Tiểu Đệ

Một tranh + một bản nhạc trong thư viện (bản dùng ít nhất, không bao giờ là bản đã gỡ) + câu kệ hợp buổi (có giọng
đọc nếu đã có bản đạt): zoom Ken Burns chậm, mờ vào và ra, nhạc nhỏ dần dưới giọng, loudnorm −16 LUFS, câu kệ in bằng
Be Vietnam Pro trong vùng an toàn Reels/TikTok (tránh 20 % dưới và cột nút bên phải), 15–60 s. Font lấy từ `fontFile`
hoặc `inet-artgen/fonts/BeVietnamPro-*.ttf`; bản `@fontsource` của web chia nhỏ theo bộ chữ (WOFF) nên drawtext không
dùng được. Chỉ nhạc và hình: không xin ủng hộ, không kêu gọi, không link, không QR.

Đầu ra: `media/videos/<id>.mp4` và `<id>.json` (tiêu đề, thẻ, độ dài, kích thước, mã bản nhạc, tranh, câu kệ, ngày tạo,
`musicAndPictureOnly: true`); file JSON ghi sau cùng nên thấy JSON là video đã đủ. Nhà máy không đăng gì.

**Đề xuất (chờ chủ dự án duyệt), không làm trong việc này:** Tiểu Đệ chạy trên máy chủ, nên PC đẩy thư mục `videos/`
lên một thư mục nhận của Tiểu Đệ (rsync như `upload-music.sh`), rồi `tieu-de-next/scripts/post-short.ts` thêm chế độ
`--chuanho` giống `--miu`: lấy video chưa đăng cũ nhất, dùng `title` và `tags` của file JSON, đăng lên các kênh như
short thường, ghi lại đã đăng trong sổ của Tiểu Đệ, và chú thích bài đăng cũng không được có lời xin ủng hộ (quy tắc
"chỉ nhạc và hình" của Chùa Nhỏ khác lệ thường của Tiểu Đệ). Bản bị gỡ (`reject`) có video dùng nó thì không đăng.

## Gỡ bản

`reject <trackId>` ghi việc gỡ vào hàng đợi (mọi gói tải lên sau đó đều bỏ bản này), in các file cần bỏ khỏi thư viện,
mục trong `manifest.json` và `beatmaps/index.json`, video đã dùng bản đó, lệnh gọi API kho nhạc
`POST /api/library/tracks/<id>/remove` (gửi `Origin` là `publicUrl` và token đọc lúc chạy từ `libraryEnvFile`, không in
ra), rồi nhắc chạy `publish-library` và tải lên với `PRUNE=1`.

## Tự động và thủ công

Tự động: sinh nhạc, tranh, giọng, video, beatmap; kiểm và loại; dựng gói thư viện. Thủ công (người vận hành): tải gói
lên máy chủ bằng lệnh nhà máy in ra, gọi API gỡ bản, duyệt đề xuất đăng video. Nhà máy không tải lên, không deploy,
không đăng mạng xã hội, không đụng `tieu-de-next`.

## Kiểm thử

`npx vitest run tools --maxWorkers=2`: hàng đợi và chuyển trạng thái, file trạng thái hỏng, khoá runner, khung giờ, cổng
nhường GPU (mẫu bận, tạm dừng tăng dần, hàng đợi ComfyUI, --health), runner với đồng hồ và đầu dò giả (thứ tự, thử lại,
không chạy song song, dừng), bộ đọc ffprobe/ebur128/silencedetect/ASR/qc-report, tham số ffmpeg, file JSON đi kèm, chọn
đầu vào video, gói thư viện, gỡ bản, `verses.json`, cấu hình, lệnh CLI, mẻ đêm, việc nhạc và tranh với lệnh giả.
