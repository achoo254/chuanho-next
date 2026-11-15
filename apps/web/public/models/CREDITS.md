# Mô hình 3D

Các tệp `.glb` trong thư mục này do AI sinh ra từ ảnh concept (cũng do AI vẽ), rồi tối ưu cho web. Không có mô hình nào chép từ
nguồn bên ngoài.

| Tệp | Ảnh concept | Seed (TRELLIS.2) |
|---|---|---|
| `mo.glb` | Vẽ lại bằng FLUX.2 klein (chỉnh sửa) từ một ảnh tham chiếu do chủ dự án cung cấp: chỉ giữ khối mõ tròn có miệng, cá chạm nổi | 42 |
| `dui.glb` | Như trên, chỉ giữ dùi cán gỗ đầu bông kem tua vàng | 42 |
| `bat.glb` | Qwen-Image: "an empty chubby brass singing bowl sitting on a small round red cushion, cute chibi stylized 3D render, vinyl toy proportions, plain light grey background" | 42 |
| `chuong.glb` | Qwen-Image: "a chubby bronze Buddhist temple bell with a loop on top, cute chibi stylized 3D render, vinyl toy proportions, plain light grey background" | 42 |
| `cot-son.glb` | Qwen-Image: "a tall straight cylindrical red lacquered temple pillar with a round gold base and a small gold capital, cute chibi stylized 3D render, plain light grey background" | 42 |

## Cách tạo

1. Ảnh concept: Qwen-Image (Apache-2.0) hoặc FLUX.2 klein 4B (Apache-2.0) trong ComfyUI.
2. Ảnh sang mô hình: **TRELLIS.2** (Microsoft, giấy phép MIT), bản int8 của Comfy-Org (MIT), voxel 1024, texture 1024.
   Bộ mã hóa ảnh đi kèm là DINOv3 (Meta, giấy phép DINOv3: miễn phí bản quyền, cấm một số mục đích như quân sự); chỉ **mô hình sinh ra**
   được phân phối ở đây, trọng số thì không. Phần "NAF" trong tệp DINOv3 chưa xác minh được nguồn và giấy phép riêng.
3. Tối ưu: `tools/models/optimize-glb.mjs` của workspace gốc (giảm mặt, tô lấp vệt đen texture, texture màu và normal map WebP,
   pháp tuyến mượt, nén lưới meshopt). Bộ giải nén của Babylon.js nằm ở `public/decoders/babylon/`.

## Những vật không dùng mô hình AI

Lư hương, sách kinh, đèn lồng, cây bồ đề, chính điện, gác chuông, tam quan và đài sen được dựng bằng code kèm texture AI, vì
TRELLIS.2 dựng các vật mỏng hoặc kiến trúc phức tạp bị méo ở độ phân giải này (đã thử và loại).
