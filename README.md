# Chùa Nhỏ

Thư mục repo: `chuanho-next` (tên hiển thị lấy từ [`brand.config.json`](brand.config.json), không có hậu tố `-next`).
Sẽ chạy tại `https://chuanho.hoandat.com`, thuộc tầng giải trí của hệ sinh thái hoandat.com.

Chùa Nhỏ là app giải trí mobile-first (PWA) cho Gen Z: vào sân chùa nhỏ, thắp nén hương, gõ mõ theo nhịp, check-in
khẩu nghiệp nhẹ nhàng không phán xét, và bật "Lofi Chùa Nhỏ" (nhạc thiền AI) khi làm việc hoặc đi ngủ.
Cam kết: không quảng cáo, không xin tiền, không bán đổi vận, không quà ảo quy đổi, không thay đi chùa thật.

**Trạng thái:** chơi được vòng cốt lõi ở chế độ khách: thắp hương (giữ ngón tay), Mõ Beat (nốt rơi theo nhạc lofi tổng
hợp bằng WebAudio, 3 độ khó, PERFECT ±80 ms (vòng sáng nằm trọn trong vòng hoa sen), GOOD ±130 ms), Mõ vô cực (gõ tự do, gõ tự động, skin mõ), Tụng kinh (chữ
sáng theo từng tiếng mõ), nhiệm vụ nhỏ trong ngày, thẻ chia sẻ 9:16 và điểm công đức lưu trong máy (một phiên đầy đủ mỗi
ngày mới cộng điểm, chỉ để trang trí sân). Ngoài vòng chơi cốt lõi còn có: **Sổ khẩu nghiệp** (check-in, "mình đã nhịn", gỡ mây 3 bước), **Dịch sang tiếng hiền** (kho câu tĩnh), **Đài** (chế độ ngủ và làm việc), **Phòng giải nghiệp** (phòng theo mã, hương cháy theo giờ thật), đăng nhập một lần bấm kèm đồng bộ hai chiều và chip **Giờ Tĩnh 22:30**. Tính năng cần server (phòng, đồng bộ, Giờ Tĩnh) chỉ chạy khi `apps/server` được deploy; chưa có server thì app coi người chơi là khách. Chưa làm: xin xăm, tiểu sa di Tiểu Đệ, phần sản xuất trên PC của Đài. Khách vẫn chơi đầy đủ, không cần server.

## Cấu trúc

| Thư mục | Vai trò |
|---|---|
| [`apps/web`](apps/web) | `@chuanho/web`: React 19 + Vite, giao diện và ngôn ngữ dùng chung từ `@achoo254/app-shell` |
| [`apps/server`](apps/server) | `@chuanho/server`: API Express 5 + Postgres (drizzle; PGlite khi dev và test), đăng nhập OIDC qua auth-next, đồng bộ, xóa dữ liệu, Giờ Tĩnh. Mỗi tính năng là một module route gắn ở danh sách `ROUTE_MODULES` trong [`app.ts`](apps/server/src/app.ts); migration SQL ở `apps/server/drizzle` |
| [`packages/contract`](packages/contract) | `@chuanho/contract`: hợp đồng dữ liệu web và server (kiểu, bộ kiểm tra, hàm gộp thuần), không phụ thuộc gói nào |
| [`apps/web/public/art`](apps/web/public/art) | Ảnh sân chùa, mascot, 4 khung hoạt ảnh gõ mõ, skin mõ (đã nén, webp) |
| [`apps/web/public/audio`](apps/web/public/audio) | Tiếng mõ (14 take), chuông/chiêng, bát, chuông nhỏ do AI tạo; vòng nhạc dự phòng và nhịp của Mõ Beat |
| [`apps/web/public/voice/sutra`](apps/web/public/voice/sutra) | Giọng AI đọc kinh (VieNeu-TTS, offline), mỗi dòng một MP3, `manifest.json` ghi độ dài từng dòng |
| [`apps/web/src/audio`](apps/web/src/audio) | WebAudio: hiệu ứng nhiều take (ngẫu nhiên, không lặp liền, lệch cao độ nhẹ), trình phát thư viện nhạc nền (xáo, không trùng trong 4 giờ nghe, chuyển bài mượt) |
| [`brand`](brand) | Biểu tượng app (bản vẽ tay tạm, thay bằng bản AI sau) |
| [`apps/web/src/game`](apps/web/src/game) | Logic thuần có test: chấm nhịp, sinh nốt theo độ khó, một phiên một ngày, nhiệm vụ theo ngày |
| [`scripts`](scripts) | `check-tokens`: kiểm màu chỉ nằm ở `tokens.css` và đủ tương phản WCAG AA |
| [`apps/web/src/engine`](apps/web/src/engine) | Bản 3D: chọn WebGPU hoặc WebGL2, khởi động và dọn Babylon.js, bộ giảm chất lượng tự động (hàm quyết định thuần có test), trang `game-3d-shell` |
| [`apps/web/src/scene`](apps/web/src/scene) | Cảnh diorama 3D: bố cục sân, bộ khối tạm, nạp mô hình theo tên, ánh sáng ba giờ trong ngày, hậu kỳ, camera tự khớp khung (và cảnh xếp lớp của bản 2D) |
| [`apps/web/src/input`](apps/web/src/input) | Chọn vật bằng tia từ con trỏ, rung và kéo camera, phím tắt |
| [`apps/web/src/character`](apps/web/src/character) | Bản 3D: nhân vật dựng bằng code (đầu, thân, tay, chân trên các nút khớp, decal mặt và má), dùi và xâu hạt trong tay, hoạt ảnh gõ mõ theo bảng khóa thời gian; các hàm thuần có test (tầm với của tay, mốc thời gian cú gõ, tư thế, thở và chớp mắt) |
| [`apps/web/src/modes`](apps/web/src/modes) | Bản 3D: các chế độ chơi trong cảnh (thắp hương, Mõ Beat, tụng kinh, Mõ vô cực, kết phiên), sân khấu nối React với cảnh (mõ trên đài sen, miệng mõ, skin, nén hương, nốt cầu sáng, bụi và khói), định tuyến từ vật sang chế độ |
| [`apps/web/src/share3d`](apps/web/src/share3d) | Bản 3D: chụp cảnh 1080 × 1920 bằng camera riêng rồi đè chữ, chỉ số bằng các bước vẽ dùng chung với thẻ 2D |
| [`apps/web/src/features`](apps/web/src/features) | Các màn HTML cắm vào sân qua [`panel-registry.tsx`](apps/web/src/features/panel-registry.tsx): `journal`, `gentle`, `radio`, `room` (và `fortune` đang để "sắp có"). Thêm màn mới = một dòng ở registry + vài dòng ở `world-actions`, `play-mode-routing`, icon và tên; mỗi màn tự mang chữ vi/en (`createFeatureText`) và CSS riêng |
| [`apps/web/src/account`](apps/web/src/account), [`sync`](apps/web/src/sync), [`quiet-hour`](apps/web/src/quiet-hour) | Đăng nhập, đồng bộ (`SyncedCollection`: thêm loại dữ liệu mới bằng một đăng ký; dữ liệu trên máy có chủ, không đẩy sang tài khoản khác) và Giờ Tĩnh |
| [`packages/contract`](packages/contract) | `@chuanho/contract`: kiểu, bộ kiểm tra và hàm gộp thuần dùng chung giữa web và server (đồng bộ, sổ, phòng, bộ lọc lời nguyện, Giờ Tĩnh) |
| [`apps/web/src/hud`](apps/web/src/hud) | HUD biểu tượng đè lên canvas, màn nạp, nút Bắt đầu, bảng "i" (giới thiệu và cam kết) |
| [`apps/web/src/fallback`](apps/web/src/fallback) | Ảnh tĩnh và thông báo ngắn cho máy không có WebGL2 |
| [`apps/web/public/models`](apps/web/public/models) | Mô hình GLB do AI sinh (mõ, dùi, bát, chuông, cột son), nguồn ở `CREDITS.md` |
| [`apps/web/public/art/character`](apps/web/public/art/character), [`apps/web/public/art/textures`](apps/web/public/art/textures) | Decal mặt và má hồng của nhân vật; texture lặp cho ngói, đá lát, sơn son, lá, gỗ |
| [`apps/web/public/decoders/babylon`](apps/web/public/decoders/babylon) | Bộ giải nén meshopt và KTX2 của Babylon 9.36 (chép nguyên từ bản phát hành), tự host để không nạp gì từ CDN |

Gói `@achoo254/*` cài từ tag git của `shared-next` (`github:achoo254/shared-next#v0.12.0&path:/packages/<gói>`),
không dùng npm registry.

## Chạy

Cần Node và pnpm theo `engines`, `packageManager` trong [`package.json`](package.json).

```sh
pnpm install
pnpm dev          # web tại http://localhost:5331, API tại 127.0.0.1:5330 (web chuyển /api, /auth sang API)
pnpm build        # apps/web/dist và bundle server apps/server/dist/server/index.mjs
pnpm typecheck
pnpm lint         # eslint + check:brand + check:tokens + check:gentle
pnpm test         # vitest, tối đa 2 worker (test server chạy PGlite trong bộ nhớ)
```

Server đọc `apps/server/.env` (mẫu ở [`.env.example`](.env.example)). Không có `DATABASE_URL` thì dùng PGlite ở
`.data/pglite`; không có `AUTH_CLIENT_SECRET` thì đăng nhập tắt, phần còn lại vẫn chạy. Đổi schema trong
`apps/server/src/db/schema.ts` rồi `pnpm --filter @chuanho/server db:generate` để sinh migration mới.

## Bản 3D (mặc định)

Trang mặc định là bản 3D (Babylon.js, WebGPU rồi WebGL2, canvas phủ toàn cửa sổ, HUD biểu tượng, thế giới là menu).
Bản 2D cũ đã gỡ hẳn: trang chỉ còn bản 3D. Babylon nằm trong các gói tách riêng.

**Camera tự do** (ở sân): kéo trên đất trống để xoay và nghiêng, cuộn chuột hoặc chụm hai ngón để zoom gần xa, nhấp đúp hoặc phím `R` để về góc nhìn ban đầu, phím `+` và `-` để zoom. Vào chế độ chơi thì camera tự về góc riêng của chế độ đó.

| Tham số thêm | Tác dụng |
|---|---|
| `renderer=webgl2` | Bỏ qua WebGPU, chạy WebGL2 để so hai đường |
| `quality=low\|medium\|high\|ultra` | Giữ cố định một mức chất lượng, tắt bộ giảm chất lượng tự động (để thử và chụp ảnh) |
| `play=room-game` | Mở thử cảnh mở đầu và minigame "Hộ hương" của Phòng giải nghiệp mà không cần máy chủ hay đăng nhập |
| `light=lanternNight\|mistyMorning` | Mở ở giờ khác (mặc định hoàng hôn); nút mặt trời trên HUD đổi giờ mượt |

Canvas ghi `data-backend`, `data-quality`, `data-fps` để kiểm nhanh trong DevTools.

### Chơi trong bản 3D

Thế giới là menu: bấm lư hương để thắp hương, giá kinh để tụng kinh, mõ để chọn Mõ Beat hoặc Mõ vô cực, chuông và bát để
nghe tiếng; bảng gỗ (Sổ, Đài) vẫn "sắp có". Thanh biểu tượng ở góc làm đường dự phòng. Phím: Space hoặc Enter gõ mõ (ở sân là
gõ cho vui), 1 đến 3 vào thắp hương, Mõ Beat, tụng kinh, Esc về sân.

- **Gõ mõ:** nhân vật giơ dùi, vung, đập xuống đỉnh mõ 45 ms sau lúc chạm (cả chuỗi khoảng 0,23 giây), mõ bẹp rồi nảy, bụi
  nhỏ bay lên, mặt nhắm mắt cười. Tiếng mõ được hẹn trên đồng hồ âm thanh đúng mốc đập (45 ms sau chạm), rung máy phát ngay
  lúc chạm. Chạm liên tục thì cú gõ bắt đầu lại, không xếp hàng.
- **Thắp hương:** giữ ngón tay hoặc chuột trên lư hương (hoặc giữ Space trên nút giữ), nén hương cháy dần, đầu than sáng, khói
  bay; xong thì thẻ nhỏ mời sang bước kế của phiên.
- **Mõ Beat:** bộ sinh nốt và chấm nhịp theo BPM, nhạc nền AI cộng tiếng nhịp AI; nốt là hoa sen (đèn lồng ở phách đầu ô nhịp) do AI vẽ,
  kéo đuôi lấp lánh bay theo đường cong vào vòng hào quang sau đỉnh mõ, chạm ở đâu trên màn hình cũng là gõ. Vòng hào
  quang và mép màn hình sáng nhẹ theo nhịp, một vòng thu dần báo lúc gõ; gõ trúng thì bung cánh sen và sao, chữ PERFECT,
  GOOD hiện trên hình AI; combo nằm trong khung cánh sen. Hình và nguồn: [`public/art/beat`](apps/web/public/art/beat/CREDITS.md).
- **Tụng kinh:** camera hạ về phía giá kinh; giọng AI đọc chậm từng dòng (nhạc nền tự hạ khi giọng đọc), dải chữ nhỏ
  ở dưới màn hình chỉ hiện dòng đang đọc (chữ đỏ chạy theo giọng) và dòng kế. Tắt giọng, tắt tiếng hoặc giọng không tải
  được thì mỗi tiếng mõ sáng một chữ như cũ. Giọng nằm ở `apps/web/public/voice/sutra` (nguồn và cách tạo ở `CREDITS.md`
  cạnh đó), chỉ tải khi vào chế độ này.
- **Mõ vô cực:** gõ tự do, "+1", gõ tự động, nền lofi, skin mõ đổi chất liệu của chính quả mõ.
- **Nhạc nền (nền lofi ở Mõ vô cực và Tụng kinh):** thư viện khoảng 4 giờ nhạc không lời phong cách Trung Hoa (sáo trúc,
  đàn tranh, chuông, bát) do AI tạo, phát xáo trộn và không lặp bài nào trong 4 giờ nghe (nhớ cả khi tải lại trang), mỗi bài
  chuyển sang bài sau trong 4 giây. Thư viện nằm trên máy chủ ở `/media/music/` (xem `docs/deployment-guide.md`); không
  tải được thì phát vòng nhạc có sẵn. Tắt tiếng trên HUD thì nhạc dừng và chạy tiếp khi bật lại; tab ẩn vẫn phát.
- **Kết phiên và chia sẻ:** thẻ kết quả, nhiệm vụ nhỏ trong ngày; đồ trang trí mở bằng công đức hiện thành vật trong sân;
  thẻ chia sẻ là ảnh chụp từ cảnh 3D kèm chỉ số tích cực.

| Tham số để chụp ảnh hoặc thử nhanh | Tác dụng |
|---|---|
| `play=yard\|incense\|beat\|sutra\|endless\|sessionEnd\|share` | Vào thẳng chế độ đó, bỏ màn Bắt đầu (tiếng mở khi chạm lần đầu) |
| `freeze=<ms>` | Giữ cú gõ ở thời điểm đó sau lúc chạm (45 là lúc đập) |
| `song=<ms>` (cùng `play=beat`) | Dừng bài Mõ Beat ở thời điểm đó, các nốt trước đã trúng; không tiếng, không lưu |

Mô hình: khi có `apps/web/public/models/<tên>.glb` (tên ở `PROP_ASSET_FILES` trong
[`diorama-layout.ts`](apps/web/src/scene/diorama-layout.ts)), mô hình thay khối dựng bằng code, được xoay và co theo
`PROP_MODEL_FITS` cho khớp chiều cao khối nó thay. Hiện dùng mô hình AI cho mõ, dùi, bát, chuông và cột son; các vật còn lại
(chính điện, gác chuông, cây bồ đề, đèn lồng, lư hương, giá kinh, đài sen) dựng bằng code kèm texture AI vì mô hình AI bị méo.
Nhân vật là chú tiểu chibi dựng bằng code; mắt, miệng và vải áo là ảnh WebP do AI vẽ trong `public/art/character/`. Chú tự đi lại trong sân (`apps/web/src/autonomy`), ngồi thiền, tụng kinh, gõ mõ, khấn vái, thỉnh chuông và nói qua bong bóng chat. Nền quanh bệ chùa là khu vườn 3D (`apps/web/src/scene/backdrop-*.ts`) với cỏ và nước vẽ bằng AI.

## Kế hoạch

Kế hoạch và các quyết định nằm ở repo workspace riêng `hoandat-app`:
`plans/dattqh/261114-2343-chua-nho-game/plan.md`.

## Giấy phép

[MIT](LICENSE).
