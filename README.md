# Chùa Nhỏ

Thư mục repo: `chuanho-next` (tên hiển thị lấy từ [`brand.config.json`](brand.config.json), không có hậu tố `-next`).
Sẽ chạy tại `https://chuanho.hoandat.com`, thuộc tầng giải trí của hệ sinh thái hoandat.com.

Chùa Nhỏ là app giải trí mobile-first (PWA) cho Gen Z: vào sân chùa nhỏ, thắp nén hương, gõ mõ theo nhịp, check-in
khẩu nghiệp nhẹ nhàng không phán xét, và bật "Lofi Chùa Nhỏ" (nhạc thiền AI) khi làm việc hoặc đi ngủ.
Cam kết: không quảng cáo, không xin tiền, không bán đổi vận, không quà ảo quy đổi, không thay đi chùa thật.

**Trạng thái:** chơi được vòng cốt lõi ở chế độ khách: thắp hương (giữ ngón tay), Mõ Beat (nốt rơi theo nhạc lofi tổng
hợp bằng WebAudio, 3 độ khó, PERFECT ±60 ms, GOOD ±120 ms), Mõ vô cực (gõ tự do, gõ tự động, skin mõ), Tụng kinh (chữ
sáng theo từng tiếng mõ), nhiệm vụ nhỏ trong ngày, thẻ chia sẻ 9:16 và điểm công đức lưu trong máy (một phiên đầy đủ mỗi
ngày mới cộng điểm, chỉ để trang trí sân). Tab Sổ và Đài đang để "Sắp có". **Chưa có server** (`apps/server` sẽ thêm khi
làm đăng nhập và đồng bộ), nên dev chỉ chạy web và chưa có proxy `/api`.

## Cấu trúc

| Thư mục | Vai trò |
|---|---|
| [`apps/web`](apps/web) | `@chuanho/web`: React 19 + Vite, giao diện và ngôn ngữ dùng chung từ `@achoo254/app-shell` |
| [`apps/web/public/art`](apps/web/public/art) | Ảnh sân chùa, mascot, 4 khung hoạt ảnh gõ mõ, skin mõ (đã nén, webp) |
| [`apps/web/public/audio`](apps/web/public/audio) | Tiếng mõ, chuông, bát (nhạc nền Mõ Beat tổng hợp trong code) |
| [`brand`](brand) | Biểu tượng app (bản vẽ tay tạm, thay bằng bản AI sau) |
| [`apps/web/src/game`](apps/web/src/game) | Logic thuần có test: chấm nhịp, sinh nốt theo độ khó, một phiên một ngày, nhiệm vụ theo ngày |
| [`scripts`](scripts) | `check-tokens`: kiểm màu chỉ nằm ở `tokens.css` và đủ tương phản WCAG AA |
| [`apps/web/src/engine`](apps/web/src/engine) | Bản 3D: chọn WebGPU hoặc WebGL2, khởi động và dọn Babylon.js, bộ giảm chất lượng tự động (hàm quyết định thuần có test), trang `game-3d-shell` |
| [`apps/web/src/scene`](apps/web/src/scene) | Cảnh diorama 3D: bố cục sân, bộ khối tạm, nạp mô hình theo tên, ánh sáng ba giờ trong ngày, hậu kỳ, camera tự khớp khung (và cảnh xếp lớp của bản 2D) |
| [`apps/web/src/input`](apps/web/src/input) | Chọn vật bằng tia từ con trỏ, rung và kéo camera, phím tắt |
| [`apps/web/src/hud`](apps/web/src/hud) | HUD biểu tượng đè lên canvas, màn nạp, nút Bắt đầu, bảng "i" (giới thiệu và cam kết) |
| [`apps/web/src/fallback`](apps/web/src/fallback) | Ảnh tĩnh và thông báo ngắn cho máy không có WebGL2 |
| [`apps/web/public/decoders/babylon`](apps/web/public/decoders/babylon) | Bộ giải nén meshopt và KTX2 của Babylon 9.36 (chép nguyên từ bản phát hành), tự host để không nạp gì từ CDN |

Gói `@achoo254/*` cài từ tag git của `shared-next` (`github:achoo254/shared-next#v0.12.0&path:/packages/<gói>`),
không dùng npm registry.

## Chạy

Cần Node và pnpm theo `engines`, `packageManager` trong [`package.json`](package.json).

```sh
pnpm install
pnpm dev          # web tại http://localhost:5331
pnpm build        # apps/web/dist
pnpm typecheck
pnpm lint         # eslint + check:brand + check:tokens
pnpm test         # vitest, tối đa 2 worker
```

## Bản 3D (đang dựng, chưa là mặc định)

Trang mặc định vẫn là bản 2D. Bản 3D (Babylon.js, canvas phủ toàn cửa sổ, HUD biểu tượng, thế giới là menu) chỉ bật khi
địa chỉ có `?v=3d` (hoặc `#3d`), ví dụ `http://localhost:5331/?v=3d`. Babylon nằm trong các gói tách riêng, chỉ tải khi
bật bản 3D, nên gói đầu của bản 2D gần như không đổi.

| Tham số thêm | Tác dụng |
|---|---|
| `renderer=webgl2` | Bỏ qua WebGPU, chạy WebGL2 để so hai đường |
| `quality=low\|medium\|high\|ultra` | Giữ cố định một mức chất lượng, tắt bộ giảm chất lượng tự động (để thử và chụp ảnh) |
| `light=lanternNight\|mistyMorning` | Mở ở giờ khác (mặc định hoàng hôn); nút mặt trời trên HUD đổi giờ mượt |

Canvas ghi `data-backend`, `data-quality`, `data-fps` để kiểm nhanh trong DevTools. Phím: Space hoặc Enter gõ mõ, 1 đến 3
chọn thắp hương, Mõ Beat, tụng kinh, Esc quay lại. Bấm vật trong sân (lư hương, giá kinh, mõ, chuông, bát, bảng gỗ) hiện
biểu tượng hành động; các chế độ chơi chưa nối vào bản 3D.

Mô hình: cảnh dựng bằng khối hình học tạm. Khi có file `apps/web/public/models/<tên>.glb` (tên ở `PROP_ASSET_FILES`
trong [`diorama-layout.ts`](apps/web/src/scene/diorama-layout.ts)), mô hình đó tự thay khối tạm, không cần sửa code.

## Kế hoạch

Kế hoạch và các quyết định nằm ở repo workspace riêng `hoandat-app`:
`plans/dattqh/261114-2343-chua-nho-game/plan.md`.

## Giấy phép

[MIT](LICENSE).
