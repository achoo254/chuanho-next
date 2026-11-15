# Triển khai Chùa Nhỏ (`chuanho.hoandat.com`)

Runbook deploy của repo này. Quy tắc chung của hệ sinh thái (tên, IdP, brand, box `.65` dùng chung) nằm ở
`docs/ecosystem-architecture.md` của workspace `hoandat-app`. Repo public: không ghi IP, cổng SSH hay user máy chủ vào
đây; dùng alias SSH (`SSH_TARGET`) và placeholder như `<SERVER_65_IP>`.

## Kiến trúc chạy

| Phần | Ở đâu |
|---|---|
| Web (React + Vite, tĩnh) | `/var/www/chuanho/dist`, nginx phục vụ trực tiếp |
| Server API (Node, Express 5, một file bundle) | systemd `chuanho-server`, loopback `127.0.0.1:5330`, Node 22 ở `/opt/node22`; đã chạy trên `.65` từ 15/11/2026 (mục Server API) |
| Database | Postgres đang chạy trên `.65`, database `chuanho`, role `chuanho`; migration chạy khi server khởi động |
| Đường vào | Cloudflare (proxied, SSL "full") → nginx `conf.d/chuanho.hoandat.com.conf` → file tĩnh; `/api/`, `/auth/`, `/healthz` → server |
| Ảnh và âm thanh | `/art/…` và `/audio/…` nằm trong bản phát hành, cache một ngày |
| Thư viện nhạc nền | `/var/www/chuanho/media/music/` (ngoài `dist/`, deploy không đụng tới), phục vụ ở `/media/music/` |

Các file: [`infra/nginx/chuanho.hoandat.com.conf`](../infra/nginx/chuanho.hoandat.com.conf),
[`infra/deploy.sh`](../infra/deploy.sh), [`infra/activate-incoming.sh`](../infra/activate-incoming.sh),
[`infra/install-nginx-conf.sh`](../infra/install-nginx-conf.sh), [`infra/upload-music.sh`](../infra/upload-music.sh),
[`infra/setup-deploy-user.sh`](../infra/setup-deploy-user.sh), [`.github/workflows/ci.yml`](../.github/workflows/ci.yml),
[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml).

Chính sách nội dung trang (CSP) trong nginx cho phép: script và style của chính trang (React ghi style inline nên style
có `'unsafe-inline'`), ảnh từ chính trang và `data:`/`blob:` (thẻ chia sẻ vẽ trên canvas rồi lưu thành blob), âm thanh từ
chính trang và `blob:` (thư viện nhạc ở `/media/music/` cùng origin nên không phải mở thêm gì), và tín hiệu
Cloudflare Web Analytics. Cảm biến nghiêng
(`accelerometer`, `gyroscope`) được cấp cho chính trang để làm hiệu ứng chiều sâu; camera, micro, vị trí bị chặn.

**Bản 3D (mặc định) và CSP.** Babylon.js không nạp gì từ CDN: mọi bộ giải nén nằm ở `/decoders/babylon/` trong bản phát
hành (meshopt, KTX2 và zstd, chép từ Babylon 9.36; Draco và glslang không host). Mô hình GLB nén meshopt cần
WebAssembly, nên CSP trong nginx có `'wasm-unsafe-eval'` ở `script-src` và `worker-src 'self' blob:`. Game hiện dùng
texture WebP, không dùng KTX2; nếu sau này đổi sang KTX2, kiểm bộ chuyển mã Basis (mã Emscripten dùng `new Function`)
trên trang thật và dùng UASTC thay vì mở `'unsafe-eval'`. Đổi CSP là đổi file nginx: chép lên `.65`, `nginx -t`,
reload (CI không đổi được nginx).

Nginx khai báo kiểu `application/wasm`, `model/gltf-binary` và cache một ngày cho `/models/` và `/decoders/`. Lưu ý: file `/models/<tên>.glb` chưa có thì `location /` trả về `index.html`
(mã 200); game nhận ra điều đó qua bốn byte đầu (`glTF`) và dùng khối tạm.

## Lần đầu

1. **DNS:** bản ghi `A` `chuanho.hoandat.com` **proxied** trỏ về `<SERVER_65_IP>` (cách gọi Cloudflare API: runbook của
   `miu-world-next`, mục DNS). Kiểm: `dig +short A chuanho.hoandat.com @1.1.1.1` trả IP của Cloudflare.
2. **Thư mục, nginx, user CI** (chạy bằng root trên `.65`):

   ```sh
   mkdir -p /var/www/chuanho/infra /var/www/chuanho/ci-incoming
   # chép infra/ lên /var/www/chuanho/infra, rồi:
   install -m 644 /var/www/chuanho/infra/nginx/chuanho.hoandat.com.conf /etc/nginx/conf.d/chuanho.hoandat.com.conf
   nginx -t && systemctl reload nginx
   bash /var/www/chuanho/infra/setup-deploy-user.sh < chuanho-deploy.pub
   ```

3. **Secret của repo** (Settings → Secrets → Actions, và environment `production`): `DEPLOY_SSH_KEY` (khoá riêng ed25519
   của `chuanho-deploy`), `DEPLOY_KNOWN_HOSTS` (`ssh-keyscan -p <cổng> -t ed25519,ecdsa,rsa <máy chủ>`), `DEPLOY_HOST`,
   `DEPLOY_PORT`.
4. **Release đầu:** push lên `main` (CI tự deploy) hoặc `SSH_TARGET=<alias> bash infra/deploy.sh`.

## Deploy tự động (CI)

Mỗi lần push lên `main` là tự deploy. `ci` (lint, typecheck, test, build) xanh thì `deploy.yml` chạy: job `build` (không có
secret) tạo artifact `apps/web/dist` với mã bản dạng `YYYYMMDD-HHMMSS-<sha12>`; job `deploy` tải artifact, rsync lên
`/var/www/chuanho/ci-incoming/<mã bản>` bằng user `chuanho-deploy`, rồi chạy lệnh sudo duy nhất user đó có:
`sudo -n /usr/local/sbin/chuanho-activate-incoming <mã bản>`. Lệnh này chuyển bản tải lên vào thư mục chỉ root đọc được
rồi mới kiểm (chỉ file và thư mục thường, có `index.html`), đổi `dist`, kiểm trang qua origin; hỏng thì trả lại `dist.prev`
và thoát mã khác 0. Cuối cùng workflow kiểm từ ngoài: `https://chuanho.hoandat.com/` trả 200 và `/RELEASE` trả đúng mã bản.

User `chuanho-deploy` chỉ ghi được `/var/www/chuanho/ci-incoming` và chạy đúng lệnh trên qua sudo; khoá trong
`authorized_keys` có `restrict`. CI không đổi được nginx hay script root: những thứ đó chỉ đổi qua `infra/deploy.sh`
chạy bằng root.

## Thư viện nhạc nền (`/media/music/`)

Nhạc nền là thư viện khoảng 4 giờ nhạc không lời do AI tạo (ACE-Step 1.5 trên PC, công cụ ở `tools/chuanho-music`
của workspace `hoandat-app`), quá lớn cho repo và cho bản phát hành (CI rsync `dist/` mỗi lần push và thay hẳn nó). Thư
viện nằm trên `.65` ở `/var/www/chuanho/media/music/` (`manifest.json` và các file `m###-<băm>.mp3`), ngoài `dist/`,
nên deploy không xoá. Nginx (`location ^~ /media/music/`) trả `audio/mpeg` cache một năm `immutable` (tên file chứa mã
băm nội dung) và hỗ trợ byte range (206) để trình duyệt stream và tua; `manifest.json` trả `application/json` với
`Cache-Control: no-cache`. File không có trả 404 (không rơi về `index.html`).

Tải lên hoặc cập nhật (chạy lại bao nhiêu lần cũng được, rsync chỉ gửi phần đổi):

```sh
SSH_TARGET=<alias> SSH_OPTS="-F <ssh_config>" bash infra/upload-music.sh <thư mục thư viện>
# PRUNE=1 để xoá trên máy chủ các bản manifest mới không còn liệt kê
```

Script kiểm mọi file manifest nêu đều có và tên an toàn, kiểm chỗ trống trên máy chủ (dừng nếu còn dưới 3 lần kích thước
thư viện), gửi các bản nhạc trước rồi `manifest.json` sau cùng (client không bao giờ thấy manifest nêu file chưa có), rồi
cài file nginx bằng `infra/install-nginx-conf.sh` (giống `deploy.sh`: `nginx -t`, hỏng thì trả file cũ, không reload).
Dung lượng: thư viện hiện tại khoảng 75 MB (MP3 mono 40 kbps); đĩa `.65` còn hàng chục GB. Kiểm sau khi tải:

```sh
curl -sI https://chuanho.hoandat.com/media/music/manifest.json      # 200, application/json, no-cache
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' -r 0-1023 https://chuanho.hoandat.com/media/music/<file>.mp3   # 206 audio/mpeg
```

Thiếu thư viện (máy chủ mới, mất mạng, chạy `pnpm dev`) thì game tự phát vòng nhạc `pad-loop.mp3` có sẵn trong bản phát
hành. Build có thể trỏ nơi khác bằng `VITE_MUSIC_BASE` (kết thúc bằng `/`).

## Server API

Mã ở [`apps/server`](../apps/server), hợp đồng dữ liệu ở [`packages/contract`](../packages/contract). Khách không cần
server; server chỉ giữ dữ liệu của người đã đăng nhập. `pnpm build` tạo `apps/server/dist/server/index.mjs` (mọi thư
viện đã gộp, chỉ cần Node) và migration nằm ở `apps/server/drizzle`. Unit:
[`infra/chuanho-server.service`](../infra/chuanho-server.service) chạy bundle từ `/var/www/chuanho/server/dist/server/`
với migration ở `/var/www/chuanho/server/drizzle` (cùng vị trí tương đối như trong repo). CI và `infra/deploy.sh` đẩy cả hai bản: bản server vào
`ci-incoming/server-<id>` rồi `chuanho-activate-server <id>` (infra/activate-server.sh: chuyển vào `server/`, restart, kiểm
`/healthz`, hỏng thì trả `server.prev`; bỏ qua nếu dịch vụ chưa cài), sau đó bản web.

| Route | Ai gọi | Việc |
|---|---|---|
| `GET /auth/login`, `GET /auth/callback`, `POST /auth/logout` | trình duyệt | Đăng nhập Code + PKCE với auth-next (scope `openid profile`), phiên riêng của app (cookie `__Host-chuanho_session`) |
| `GET /api/me` | web | `{ id, name }` (tên ngắn, không bao giờ là email) hoặc `401` |
| `POST /api/sync` | web, đã đăng nhập | Gộp tiến trình và sổ khẩu nghiệp hai chiều theo con trỏ `server_seq` |
| `DELETE /api/me/data` | web, đã đăng nhập | Xóa hẳn tiến trình, toàn bộ sổ và số nhịp Giờ Tĩnh của người đó; tài khoản và phiên giữ nguyên |
| `GET /api/quiet-hour` | ai cũng được | Trạng thái Giờ Tĩnh (22:30–23:00 giờ Việt Nam), tổng nhịp và mốc của ngày |
| `POST /api/quiet-hour/beats` | web, đã đăng nhập | Lô nhịp nhỏ; chỉ nhận trong giờ, mỗi người tối đa `QUIET_HOUR_PERSON_CAP` nhịp mỗi đêm |
| `POST /api/idp/account-deleted` | IdP | Tài khoản bị xóa ở `auth.hoandat.com/account`: kiểm SET ký ES256 bằng JWKS của IdP rồi xóa dòng `users` và mọi thứ cascade theo |
| `GET /healthz` | nginx, kiểm tra | `ok` khi database trả lời |

Giới hạn: đăng nhập 100 lần bắt đầu mỗi 15 phút mỗi IP; đồng bộ 120 lần mỗi 15 phút và lô nhịp 150 lần mỗi 5 phút, tính
theo phiên. Body đồng bộ tối đa 2 MB (nginx `client_max_body_size 2m` ở khối API). Log không ghi body, ghi chú trong sổ
hay tham số truy vấn (`apps/server/src/log-error.ts`, có test).

### Biến môi trường

Mẫu: [`.env.example`](../.env.example). Giá trị thật nằm ở thư mục env trên iCloud (`ENV production/chuanho-next/`),
không bao giờ trong repo. Trên server là `/etc/chuanho/production.env` (`root:chuanho`, 640).

| Biến | Production |
|---|---|
| `NODE_ENV` | `production` (bắt buộc có `DATABASE_URL`, `AUTH_CLIENT_SECRET`, `PUBLIC_URL` https) |
| `PORT` | `5330` (kiểm còn trống trước khi cài: `ss -ltnp \| grep 5330`) |
| `PUBLIC_URL` | `https://chuanho.hoandat.com` |
| `DATABASE_URL` | `postgres://chuanho:<mật khẩu>@127.0.0.1:5432/chuanho` |
| `AUTH_ISSUER` | `https://auth.hoandat.com` |
| `AUTH_CLIENT_ID` | `chuanho-web` |
| `AUTH_CLIENT_SECRET` | secret của client `chuanho-web`, cùng giá trị với `CHUANHO_WEB_CLIENT_SECRET` trên IdP (≥ 32 ký tự) |

### Lần đầu bật server

1. **IdP (repo `auth-next`, làm trước):** thêm `chuanho-web` vào nhóm client chỉ-đăng-nhập
   (`src/oidc/sign-in-only-clients.ts` cùng kiểu `tuvi-web`: confidential, `client_secret_basic`, Code + PKCE, không
   refresh token, redirect `https://chuanho.hoandat.com/auth/callback`, post-logout `https://chuanho.hoandat.com/`), cặp
   biến `CHUANHO_WEB_URL=https://chuanho.hoandat.com` và `CHUANHO_WEB_CLIENT_SECRET`, rồi deploy IdP. Thêm
   `https://chuanho.hoandat.com/api/idp/account-deleted` vào `ACCOUNT_DELETED_URLS` của IdP (phải đúng từng ký tự với
   `PUBLIC_URL` + `/api/idp/account-deleted`). Chưa có client này thì đăng nhập báo lỗi, phần còn lại của app vẫn chạy.
2. **Database** (trên `.65`, hỏi người trước):

   ```sh
   sudo -u postgres psql -c "CREATE ROLE chuanho LOGIN PASSWORD '<mật khẩu>'"
   sudo -u postgres createdb -O chuanho chuanho
   ```

   Thêm dòng `host chuanho chuanho 127.0.0.1/32 scram-sha-256` vào `pg_hba.conf` (cạnh các dòng của sản phẩm khác) rồi
   `systemctl reload postgresql`. Không tạo instance Postgres mới.
3. **User và env:** user hệ thống `chuanho` (không shell); ghi `/etc/chuanho/production.env` từ thư mục env trên iCloud
   qua ssh stdin, không in giá trị ra màn hình.
4. **Bản server và unit:** đẩy `apps/server/dist` và `apps/server/drizzle` vào `/var/www/chuanho/server/`, cài
   `infra/chuanho-server.service` vào `/etc/systemd/system/`, `systemctl daemon-reload && systemctl enable --now
   chuanho-server`, rồi cài lại file nginx (`nginx -t`, reload).
5. **Kiểm:** `journalctl -u chuanho-server -n 20` có `sign-in: on (chuanho-web …)`; `curl -fsS
   https://chuanho.hoandat.com/healthz` trả `ok`; `curl -s https://chuanho.hoandat.com/api/quiet-hour` trả JSON;
   `curl -s -o /dev/null -w '%{http_code}\n' https://chuanho.hoandat.com/api/me` trả `401`.

Quay lui server: `systemctl disable --now chuanho-server` (web tĩnh vẫn chạy, đăng nhập báo lỗi). Log:
`journalctl -u chuanho-server`.

## Quay lui

```sh
ssh <target> 'cd /var/www/chuanho && rm -rf dist && mv dist.prev dist'
```

Ảnh hay âm thanh giữ nguyên tên mà thay nội dung thì Cloudflare và trình duyệt có thể giữ bản cũ tới một ngày: purge
cache các URL đó trên Cloudflare, rồi so mã băm của URL thật (không query) với file trong repo.

## Gỡ bỏ

Xoá `/etc/nginx/conf.d/chuanho.hoandat.com.conf` (`nginx -t` rồi reload), xoá `/var/www/chuanho`, user `chuanho-deploy` và
`/etc/sudoers.d/chuanho-deploy`, xoá bản ghi DNS. Nếu server đã bật: `systemctl disable --now chuanho-server`, xoá unit,
`/etc/chuanho`, user `chuanho`, database và role `chuanho` (sao lưu trước), client `chuanho-web` trên IdP.
