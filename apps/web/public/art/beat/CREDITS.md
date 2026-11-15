# Hình Mõ Beat

Mọi hình trong thư mục này do mô hình AI chạy offline trên máy của chủ dự án vẽ (Z-Image-Turbo nền trong suốt qua
BiRefNet cho các vật, Qwen-Image-2512 trên nền đen cho quầng sáng và ngôi sao, qua ComfyUI), rồi cắt, xếp và nén WebP
bằng Pillow và cwebp. Không hình nào chép từ nguồn ngoài hay từ mockup cũ. Chữ trong game (PERFECT, GOOD, Trượt, số
combo) là chữ HTML thật, không vẽ bằng AI.

AI-generated for the hoandat ecosystem; owned by hoandat, all rights reserved (not CC0).

| Tệp | Nội dung | Dùng ở |
|---|---|---|
| `beat-atlas.webp` | Bảng 4 × 2 ô 256 px: hoa sen (nốt thường), đèn lồng giấy (nốt phách đầu ô nhịp), quầng sáng, ngôi sao lấp lánh, cánh sen (bung khi gõ trúng). Màu lưu ở không gian tuyến tính vì bộ vẽ sprite của Babylon không giải mã sRGB | `src/modes/beat-sprite-atlas.ts` |
| `target-ring.webp` | Vòng hào quang nụ sen và hạt sáng vàng sau mõ, là vạch gõ | `src/modes/beat-target-ring.ts` |
| `judge-perfect.webp`, `judge-good.webp`, `judge-miss.webp` | Mặt trời cánh sen, mây tím hồng, mây mưa nhỏ sau chữ chấm điểm và trong thẻ kết quả | `src/modes/beat-judgement.tsx`, `src/modes/beat-cards.tsx` |
| `level-easy.webp`, `level-normal.webp`, `level-hard.webp` | Nụ sen, sen hé, sen nở rực cho ba độ khó (nụ sen cũng là biểu tượng pin bình yên) | `src/modes/beat-cards.tsx`, `src/modes/beat-hud.tsx` |
| `combo-badge.webp` | Khung tròn cánh sen viền vàng cho số combo | `src/modes/beat-hud.tsx`, `src/modes/beat-cards.tsx` |
| `garland.webp` | Dây hoa sen và đèn lồng trên đầu thẻ chọn độ khó và thẻ kết quả | `src/modes/beat-cards.tsx` |
