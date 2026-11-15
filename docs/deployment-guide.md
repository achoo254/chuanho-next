# Triển khai Chùa Nhỏ (`chuanho.hoandat.com`)

Runbook deploy của repo này. Quy tắc chung của hệ sinh thái (tên, IdP, brand, box `.65` dùng chung) nằm ở
`docs/ecosystem-architecture.md` của workspace `hoandat-app`. Repo public: không ghi IP, cổng SSH hay user máy chủ vào
đây; dùng alias SSH (`SSH_TARGET`) và placeholder như `<SERVER_65_IP>`.

## Kiến trúc chạy

| Phần | Ở đâu |
|---|---|
| Web (React + Vite, tĩnh) | `/var/www/chuanho/dist`, nginx phục vụ trực tiếp |
| Server API, database | Chưa có ở bản hiện tại (khách chơi hoàn toàn trên trình duyệt, tiến trình lưu trong máy) |
| Đường vào | Cloudflare (proxied, SSL "full") → nginx `conf.d/chuanho.hoandat.com.conf` → file tĩnh |
| Ảnh và âm thanh | `/art/…` và `/audio/…` nằm trong bản phát hành, cache một ngày |

Các file: [`infra/nginx/chuanho.hoandat.com.conf`](../infra/nginx/chuanho.hoandat.com.conf),
[`infra/deploy.sh`](../infra/deploy.sh), [`infra/activate-incoming.sh`](../infra/activate-incoming.sh),
[`infra/setup-deploy-user.sh`](../infra/setup-deploy-user.sh), [`.github/workflows/ci.yml`](../.github/workflows/ci.yml),
[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml).

Chính sách nội dung trang (CSP) trong nginx cho phép: script và style của chính trang (React ghi style inline nên style
có `'unsafe-inline'`), ảnh từ chính trang và `data:`/`blob:` (thẻ chia sẻ vẽ trên canvas rồi lưu thành blob), âm thanh từ
chính trang và `blob:` (nhạc nền tổng hợp ngay trong trình duyệt), và tín hiệu Cloudflare Web Analytics. Cảm biến nghiêng
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

## Quay lui

```sh
ssh <target> 'cd /var/www/chuanho && rm -rf dist && mv dist.prev dist'
```

Ảnh hay âm thanh giữ nguyên tên mà thay nội dung thì Cloudflare và trình duyệt có thể giữ bản cũ tới một ngày: purge
cache các URL đó trên Cloudflare, rồi so mã băm của URL thật (không query) với file trong repo.

## Gỡ bỏ

Xoá `/etc/nginx/conf.d/chuanho.hoandat.com.conf` (`nginx -t` rồi reload), xoá `/var/www/chuanho`, user `chuanho-deploy` và
`/etc/sudoers.d/chuanho-deploy`, xoá bản ghi DNS.
