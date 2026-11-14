# Chùa Nhỏ

Thư mục repo: `chuanho-next` (tên hiển thị lấy từ [`brand.config.json`](brand.config.json), không có hậu tố `-next`).
Sẽ chạy tại `https://chuanho.hoandat.com`, thuộc tầng giải trí của hệ sinh thái hoandat.com.

Chùa Nhỏ là app giải trí mobile-first (PWA) cho Gen Z: vào sân chùa nhỏ, thắp nén hương, gõ mõ theo nhịp, check-in
khẩu nghiệp nhẹ nhàng không phán xét, và bật "Lofi Chùa Nhỏ" (nhạc thiền AI) khi làm việc hoặc đi ngủ.
Cam kết: không quảng cáo, không xin tiền, không bán đổi vận, không quà ảo quy đổi, không thay đi chùa thật.

**Trạng thái:** mới có khung web (màn đầu với dải cam kết và nút "Bắt đầu"). Chưa có game, **chưa có server**
(`apps/server` sẽ thêm khi làm đăng nhập và đồng bộ), nên dev chỉ chạy web và chưa có proxy `/api`.

## Cấu trúc

| Thư mục | Vai trò |
|---|---|
| [`apps/web`](apps/web) | `@chuanho/web`: React 19 + Vite, giao diện và ngôn ngữ dùng chung từ `@achoo254/app-shell` |
| [`apps/web/public/art`](apps/web/public/art) | Ảnh sân chùa, mascot (thêm sau, đã nén) |
| [`apps/web/public/audio`](apps/web/public/audio) | Tiếng mõ, chuông, nhạc (thêm sau, đã nén) |
| [`brand`](brand) | Biểu tượng app (bản vẽ tay tạm, thay bằng bản AI sau) |
| [`scripts`](scripts) | `check-tokens`: kiểm màu chỉ nằm ở `tokens.css` và đủ tương phản WCAG AA |

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

## Kế hoạch

Kế hoạch và các quyết định nằm ở repo workspace riêng `hoandat-app`:
`plans/dattqh/261114-2343-chua-nho-game/plan.md`.

## Giấy phép

[MIT](LICENSE).
