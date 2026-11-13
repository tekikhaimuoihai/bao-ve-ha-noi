# Bảo vệ HN cùng đại ca Vũ Tuấn Anh

Game bắn súng góc nhìn thứ nhất (FPS) 3D chạy ngay trên trình duyệt, bối cảnh Phố Cổ Hà Nội đêm Trung thu 2026.

**Chơi ngay:** https://tekikhaimuoihai.github.io/bao-ve-ha-noi/

Game được tạo bởi Vũ Tuấn Anh · 2026 · Liên hệ: 0904641180

## Lối chơi

Một ván khoảng 5 đến 10 phút, gồm 3 chặng:

1. Tìm và phá 3 Cổng Bóng trong các phố (Hàng Bạc, Hàng Buồm, Mã Mây). Mỗi cổng vỡ rơi ra súng hoặc đồ hồi máu.
2. Về quảng trường, giữ vững qua 3 đợt quái.
3. Hạ trùm cuối Thuồng Luồng. Bắn vào đầu gây gấp đôi sát thương, nhất là lúc nó vừa lao xuống đất.

- 4 loại súng: súng lục, súng săn, súng trường, súng pháo hoa.
- 4 loại quái: Quỷ Lóc Chóc, Ma Trơi, Quỷ Pháo, Quỷ Đầu Trâu, cộng trùm Thuồng Luồng.
- Vật phẩm: bánh mì (hồi máu), Trà Sữa Ông Tuấn Anh (hồi máu, chạy nhanh, bắn mạnh 15 giây), hộp đạn.
- 3 mức khó, bảng xếp hạng lưu trên trình duyệt của máy đang chơi.
- Tiếng Việt (mặc định) và tiếng Anh.

## Điều khiển

| | Máy tính | Điện thoại | Tay cầm |
|---|---|---|---|
| Di chuyển | WASD | Cần gạt trái | Cần trái |
| Ngắm | Chuột | Vuốt nửa phải màn hình | Cần phải |
| Bắn | Chuột trái | Nút BẮN (giữ và kéo để ngắm) | RT |
| Ngắm sâu | Chuột phải | Nút NGẮM | LT |
| Nhảy / Chạy | Space / Shift | Nút NHẢY / đẩy hết cần gạt | A / L3 |
| Nạp đạn / Đổi súng | R / 1-4, lăn chuột | Nút NẠP / ĐỔI | X / Y, RB |
| Tạm dừng | Esc | Nút II | Start |

## Kỹ thuật

- Toàn bộ game là một file `index.html` (khoảng 1 MB), mở là chơi, không cần cài đặt hay máy chủ.
- Đồ họa: three.js r159 (đóng gói sẵn trong file), shader GLSL tự viết cho bầu trời, cổng, hạt và hậu kỳ (bloom, tone mapping, vignette).
- Nhà, biển hiệu, texture đều sinh bằng code (canvas). Biển trà sữa dùng ảnh do tác giả cung cấp.
- Âm thanh và nhạc nền (thang ngũ cung, tiếng đàn bầu tổng hợp) đều tổng hợp trực tiếp bằng Web Audio API, không dùng file âm thanh.
- Cài đặt: chất lượng đồ họa, độ nhạy chuột và cảm ứng, FOV, âm lượng, đảo trục, hiện FPS.

## Sửa code

Mã nguồn nằm trong `src/`. Sau khi sửa, chạy:

```
python3 build.py
```

để ghép lại thành `index.html`.

## Giấy phép bên thứ ba

three.js: MIT License, Copyright 2010-2023 three.js authors (https://github.com/mrdoob/three.js).

## Mô hình 3D

Mô hình súng dùng giấy phép CC0 (miễn phí, không ràng buộc):
- Súng lục, súng săn, súng trường: "Ultimate Gun Pack" của Quaternius (quaternius.com).
- Pháo hoa: "Weapon Pack" của Kenney (kenney.nl).

Chi tiết trong `assets/models/LICENSES.txt`. Tay, vỏ đạn, khói, phố phường và quái đều được dựng bằng code.

