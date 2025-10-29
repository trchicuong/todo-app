# ✅ Todo App - Phần mềm quản lý công việc

Một dự án To-Do List hiện đại, được xây dựng với Vite và JavaScript thuần. Tích hợp AI để nâng cao hiệu suất làm việc và có thể cài đặt như một ứng dụng độc lập (PWA).

> **[Xem Demo trực tiếp](https://todo.trchicuong.id.vn/)**

> Tài liệu chức năng chi tiết: xem file [FUNCTION.md](./FUNCTION.md)

---

## ⚡️ Quick start (cài đặt)

1. Tải mã nguồn và chuẩn bị môi trường

```powershell
# Clone repo (hoặc tải .zip rồi giải nén)
git clone https://github.com/trchicuong/todo-app.git
cd todo-app

# Cài Node.js >= 18 nếu máy chưa có
# https://nodejs.org/
```

2. Cài dependencies

```powershell
npm install
```

3. Đổi tên file .env.example ở thư mục gốc thành .env (AI/PUSH — tuỳ chọn)

```dotenv
# AI (tuỳ chọn để dùng Cố vấn AI)
VITE_AI_API_KEY=your_google_generative_language_api_key
# Tuỳ chọn: có thể đặt "gemini-2.5-flash" (app sẽ tự thêm prefix models/ nếu thiếu)
VITE_AI_MODEL=models/gemini-2.5-flash

# Push Notifications (tuỳ chọn nếu muốn nhận nhắc khi đóng app)
VITE_VAPID_PUBLIC_KEY=<publicKey_base64url>
VITE_PUSH_SERVER_URL=<https://your-push-server>
```

4. Chạy dev

```powershell
npm run dev
```

Mở trình duyệt tới địa chỉ được in ra (mặc định http://localhost:5173).

5. Build sản xuất (tuỳ chọn)

```powershell
npm run build
```

Gợi ý: Bật HTTPS khi triển khai để thông báo đẩy hoạt động ổn định.

---

## �🔔 Thông báo & Push

Ứng dụng sử dụng Push Notifications thông qua Service Worker để gửi nhắc nhở công việc, hoạt động kể cả khi đóng tab/app.

Yêu cầu:

- Chạy trên HTTPS (hoặc localhost) để đăng ký Service Worker/Push.
- Tạo VAPID keys và một server để gửi push.

Cấu hình client (.env):

```
VITE_VAPID_PUBLIC_KEY=<publicKey_base64url>
VITE_PUSH_SERVER_URL=<https://your-push-server>
```

Luồng hoạt động:

1. Vào Cài đặt → "Thông báo đẩy (Push)" → bấm "Đăng ký". Client sẽ đăng ký PushManager, gửi subscription lên server và tự động lập lịch thông báo cho các công việc sắp đến hạn.
2. Bấm "Gửi thử" để yêu cầu server gửi 1 push test về. Service Worker (sw-custom.js) sẽ hiển thị thông báo ngay cả khi app đóng.
3. Server sẽ gửi thông báo khi công việc đến hạn hoặc trước hạn (nếu cấu hình nhắc trước).

Gợi ý triển khai server (chọn một):

- OneSignal, Firebase Cloud Messaging (FCM) – nhanh, ít code backend.
- Netlify Functions (đã tích hợp sẵn trong repo):
  - Endpoint: `/.netlify/functions/subscribe` và `/.netlify/functions/test`
  - Cài đặt biến môi trường tại Netlify Dashboard: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`
  - Client: đặt `VITE_PUSH_SERVER_URL=/.netlify/functions`
  - Thư viện server: `web-push`

Lưu ý: Nếu đang phát triển trên HTTP qua XAMPP, thông báo có thể không hoạt động do thiếu secure context. Hãy dùng `npm run dev` (localhost) hoặc cấu hình HTTPS.

---

## 🤖 Cố vấn AI (Gemini)

- Mô hình mặc định: `models/gemini-2.5-flash` (có thể đổi qua biến `VITE_AI_MODEL`).
- Chạy chế độ: Sắp xếp ưu tiên, Gợi ý hạn chót, Kế hoạch hôm nay, Ước tính thời lượng.
- Giới hạn: xử lý tối đa 10 công việc mỗi lần (ưu tiên trễ/gấp trước).
- Chống spam API: ứng dụng có cooldown ngắn giữa các lần chạy để bảo vệ API key.

Cấu hình .env đã nêu ở phần Quick start. Nếu thiếu `VITE_AI_API_KEY` ứng dụng sẽ hiển thị hướng dẫn cài đặt.

<!-- Gỡ nội dung cài đặt trùng lặp; Quick start ở trên là hướng dẫn duy nhất -->

---

## 🧩 Tính năng nổi bật

- Thêm nhanh (Quick Add) với ngôn ngữ tự nhiên: `#tag`, `!cao/!trung/!thấp` hoặc “ưu tiên …”, thời gian `15:00`, ngày `dd/mm` hoặc `dd/mm/yyyy`, “hôm nay/mai”, “nhắc 10p”, “sau 30p”, “lặp ngày/tuần/tháng”, “ước 30p” (ước tính), `c:"Tên hạng mục"`, `ghi chú: ...`.
- Nút “Xem ví dụ” chèn mẫu câu vào ô Thêm nhanh; Nút thu âm (voice) để nhập bằng giọng nói.
- Tác vụ: ghi chú (Markdown), thẻ (tags), nhắc trước, ước tính thời lượng, lặp lại, độ ưu tiên, kéo-thả sắp xếp, gợi ý ưu tiên thông minh.
- Tiện ích: Hoãn nhắc (Snooze), Dời thông minh, Tập trung 25’ (Pomodoro), Chia sẻ (kể cả 1 task dạng JSON).
- Sao lưu/khôi phục: Xuất/nhập JSON, có tuỳ chọn xuất kèm cài đặt.
- Hướng dẫn theo tab, thống kê nhanh, “nudge” nhắc việc sắp đến hạn.
- PWA: có thể cài như app; hỗ trợ Push Notifications với quiet hours.

Chi tiết đầy đủ xem [FUNCTION.md](./FUNCTION.md).

---

## 🛠️ Troubleshooting

- Không nhận thông báo đẩy: kiểm tra HTTPS/Service Worker, và `VITE_VAPID_PUBLIC_KEY`, `VITE_PUSH_SERVER_URL`.
- AI báo thiếu cấu hình: kiểm tra `VITE_AI_API_KEY`; nếu lỗi 403 hãy xác nhận hạn mức/billing và model.
- Vite không build được: xem log console để tìm dòng lỗi, nhiều lỗi do chỉnh sửa HTML chưa đóng thẻ.

---

### 📁 Cấu trúc thư mục

```
todo-app/
├── public/
│   ├── images/
│   │   ├── android-chrome-192x192.png
│   │   ├── android-chrome-512x512.png
│   │   ├── apple-touch-icon.png
│   │   ├── favicon-16x16.png
│   │   ├── favicon-32x32.png
│   │   ├── favicon.ico
│   │   └── site.webmanifest
│   ├── sound/
│   │   └── notification.mp3
│   ├── particles.js
│   └── sw-custom.js
├── src/
│   ├── css/
│   │   ├── landing.css
│   │   └── style.css
│   └── js/
│       ├── app.js
│       └── landing.js
├── netlify/
│   └── functions/
│       ├── subscribe.js
│       ├── schedule.js
│       └── test.js
├── netlify.toml
├── .env.example
├── .gitignore
├── dashboard.html
├── index.html
├── vite.config.js
├── package.json
├── package-lock.json
├── README.md
├── FUNCTION.md
└── LICENSE
```

---

### 🤝 Đóng góp

Dự án này luôn chào đón các đóng góp! Nếu bạn muốn sửa lỗi, thêm một công cụ mới, hoặc cải thiện mã nguồn, hãy thoải mái tạo một `Pull Request`.

---

### ✉️ Góp ý & Liên hệ

Nếu bạn có bất kỳ ý tưởng nào để cải thiện công cụ hoặc phát hiện lỗi, đừng ngần ngại mở một `Issue` trên repo này.

Mọi thông tin khác, bạn có thể liên hệ với tôi qua:
[**trchicuong.id.vn**](https://trchicuong.id.vn/)
