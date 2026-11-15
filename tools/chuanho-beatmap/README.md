# chuanho-beatmap

Sinh beatmap Mõ Beat cho từng bản trong thư viện nhạc nền (thư viện do `tools/chuanho-music` của workspace
`hoandat-app` tạo, xem `docs/deployment-guide.md` mục "Thư viện nhạc nền"). Chỉ dùng Node, `tsx` của repo và `ffmpeg`
trên PATH; không thêm thư viện. Kết quả xác định: cùng file nhạc luôn ra cùng beatmap.

## Chạy

```sh
pnpm exec tsx tools/chuanho-beatmap/cli.ts <thư mục thư viện> [--out <thư mục>]
SSH_TARGET=<alias> SSH_OPTS="-F <ssh_config>" bash infra/upload-music.sh <thư mục thư viện>
```

- Đọc `<thư mục thư viện>/manifest.json` (mục có id hoặc tên file không an toàn bị bỏ và báo), giải mã từng bản bằng
  ffmpeg ra PCM mono 11 025 Hz.
- Ghi `<out>/beatmaps/<trackId>.json` rồi `<out>/beatmaps/index.json` sau cùng; `<out>` mặc định là chính thư mục thư
  viện, nên `upload-music.sh` gửi luôn thư mục `beatmaps/` (file beatmap trước, `index.json` sau, `manifest.json` cuối).
  Mỗi file ghi ra tên tạm rồi đổi tên, chạy dở không để lại file hỏng.
- In mỗi bản một dòng (bpm, độ tin, tỉ lệ trúng, độ đều, độ tương phản, số nốt mỗi mức) và một dòng tổng. Thoát mã 1
  khi không phân tích được bản nào. Khoảng 0,3 s mỗi bản.

## Đầu ra

```jsonc
// beatmaps/<trackId>.json
{ "version": 1, "trackId": "m001", "bpm": 60.02, "offsetMs": 1234, "confidence": 0.93, "playable": true,
  "levels": { "easy": [1234, 3233, ...], "normal": [...], "hard": [...] } }   // ms tính từ đầu file nhạc
// beatmaps/index.json
{ "version": 1, "tracks": [{ "trackId": "m001", "bpm": 60.02, "durationMs": 139900, "playable": true }, ...] }
```

Bản có `playable: false` không có `levels`; game không đưa vào Mõ Beat nhưng Đài vẫn phát bình thường.

## Cách dò

1. `onset-envelope.ts`: spectral flux nén log, trừ xu hướng chậm, đo vùng có tiếng (bỏ lặng và fade).
2. `tempo-grid.ts`: tự tương quan có lược (comb) tìm nhịp chủ đạo, gập về một quãng tám 55–110 BPM (nhịp nhanh hơn chia
   đôi, chậm hơn nhân đôi), thử thêm các cách đọc 3:2 và 2:3, rồi dò lưới cứng (tempo ± 1,5 BPM, pha) khớp nhiều năng
   lượng onset nhất trên cả bản. Phách đầu ô nhịp là vị trí trong 4 phách có tổng onset lớn nhất.
3. `beat-confidence.ts`: độ tin = tỉ lệ phách trúng onset rõ (tính cả trường hợp chỉ phách cách một trúng) × tỉ lệ cửa
   sổ 8 phách không lệch quá 35 ms, về 0 khi phách không nổi hơn điểm 1/4 phách. Dưới 0,5 thì không chơi được.
4. `beatmap-levels.ts`: dễ = cách một phách từ phách đầu ô nhịp; thường = mọi phách + tối đa 10 % nửa phách có onset
   mạnh nhất; khó = mọi phách + mọi nửa phách nhạc có onset thật. Khoảng cách tối thiểu 900 / 300 / 250 ms, không có nốt
   trong 3 s cuối. Bản dưới 16 nốt mức dễ thì không chơi được.

Vùng gập 55–110 BPM là một quãng tám để mỗi nhịp gập về đúng một giá trị (thư viện được nhắc ở 50–66 BPM; bản 50–54
BPM thành lưới 100–108 và mức dễ rơi đúng nhịp nghe được).

## Kiểm thử

`npx vitest run tools --maxWorkers=2`: track tiếng click tổng hợp ngay trong test (không có file âm thanh trong repo):
tempo sai dưới 1 BPM, phách đầu sai dưới 20 ms, gập nửa/gấp đôi, mật độ và khoảng cách từng mức, loại bản không có nhịp,
im lặng, nhiễu và bản quá ngắn.
