# 📘 FUNCTION.md — Các chức năng của Todo App

Tài liệu này mô tả đầy đủ các chức năng của ứng dụng Todo App, kèm mẹo sử dụng nhanh.

---

## 1) Khái niệm cơ bản

- Hạng mục (Category): nhóm công việc. Mặc định có “Công việc” và “Cá nhân”. Có thể thêm/xoá.
- Công việc (Task): gồm tên, hạn chót (tuỳ chọn), nhắc trước (tuỳ chọn), độ ưu tiên, thẻ (tags), ghi chú (Markdown), ước tính thời lượng (phút), lặp lại (none/daily/weekly/monthly).
- Lưu trữ: dữ liệu và cài đặt được lưu trong localStorage của trình duyệt. Push Notifications cần server riêng.

---

## 2) Thêm nhanh (Quick Add)

Gõ một câu ngắn gọn vào ô “Thêm nhanh”, nhấn Enter để tạo công việc. Cú pháp hỗ trợ:

- #tag — thêm thẻ. Ví dụ: `#work`, `#school`.
- !cao / !trung / !thấp — đặt ưu tiên. Có thể gõ tiếng Việt: “ưu tiên cao/trung/thấp”.
- Thời gian/ngày: `15:00`, `dd/mm`, `dd/mm/yyyy`, hoặc từ khoá “hôm nay/mai”.
- Nhắc trước: “nhắc 10p”, hoặc “sau 30p” (nếu chưa có hạn, sẽ tự đặt hạn là now+30p).
- Lặp lại: “lặp ngày/tuần/tháng”.
- Ước tính thời lượng: “ước 30p” hoặc “~30p/est 30m”.
- Hạng mục: `c:"Tên hạng mục"` hoặc `c:Tên`.
- Ghi chú: `ghi chú: nội dung…`.

Ví dụ hữu ích:

- `Họp dự án 15:00 31/10 #work !cao nhắc 10p ước 30p`
- `Mua quà sinh nhật 20:00 mai #personal !trung c:"Cá nhân"`
- `Tập thể dục 06:30 lặp ngày !thấp ước 20p`

Nút “Xem ví dụ” giúp chèn mẫu nhanh. Nút microphone cho phép nhập bằng giọng nói (trình duyệt sẽ hỏi quyền truy cập).

---

## 3) Tác vụ & thao tác

- Hoàn thành: tích vào ô checkbox.
- Đổi ưu tiên: bấm vào vạch màu bên trái để xoay vòng Thấp/Trung/Cao. Nếu bật “Gợi ý ưu tiên”, sẽ có đề xuất dựa trên hạn và nội dung.
- Kéo-thả sắp xếp: dùng icon 6 chấm để kéo (trên mobile chỉ kéo bằng icon).
- Ghi chú: hỗ trợ Markdown; app dùng DOMPurify để làm sạch.
- Thẻ: nhập trong form thêm/sửa; Enter hoặc dấu phẩy để thêm; Backspace khi trống xoá thẻ cuối; dán nhiều thẻ được.

Tiện ích cạnh task:

- Snooze (Hoãn nhắc): nhanh +30p, +1h, +1d, +1w; có tuỳ chọn “nhắc đúng giờ mới”.
- Dời thông minh: gợi ý các mốc gần thuận tiện (chiều 16:00, sáng mai 09:00, cuối tuần, thứ Hai tuần tới…).
- Tập trung 25’ (Pomodoro): đồng hồ đếm ngược, phù hợp các việc tập trung ngắn.
- Chia sẻ: sao chép nội dung hoặc tải file JSON (1 task) để gửi cho người khác; có thể nhập lại trong app.

Duplicate detection: khi thêm một công việc trùng hoặc gần giống, app mời bạn gộp dữ liệu (ưu tiên hạn sớm, ưu tiên cao, trộn thẻ và ghi chú) hoặc giữ cả hai.

Smart nudge: khi có việc sắp đến hạn trong 60 phút, hiển thị banner gợi ý “Tập trung 25’”.

---

## 4) Lọc / Sắp xếp / Tìm kiếm

- Bộ lọc: Tất cả, Cần làm, Hoàn thành.
- Sắp xếp: Mặc định, Theo độ ưu tiên, Theo hạn chót.
- Tìm kiếm: nhấn `/` để focus nhanh; tìm theo tên và thẻ.

---

## 5) Cố vấn AI

Chức năng AI giúp lên kế hoạch/ước tính nhanh. Các chế độ:

- Sắp xếp ưu tiên (priority_order)
- Gợi ý hạn chót (due_date_suggestions)
- Kế hoạch hôm nay (today_plan)
- Ước tính thời lượng (duration_estimates)

Đặc điểm:

- Xử lý tối đa 10 công việc mỗi lần (ưu tiên việc gấp/trễ).
- Tôn trọng “giờ yên lặng” khi đề xuất thời gian.
- Đầu ra JSON gọn, có thể áp dụng từng mục hoặc tất cả.
- Chống spam API: có cooldown ngắn giữa các lần chạy, hiển thị đếm ngược trên nút và trong modal.

Cấu hình:

- `.env`: `VITE_AI_API_KEY`, `VITE_AI_MODEL` (mặc định `models/gemini-2.5-flash`).

---

## 6) Thông báo & Giờ yên lặng

- Bật trong Cài đặt → Thông báo đẩy (Push). Cần HTTPS và server push.
- Giờ yên lặng: tránh thông báo ban đêm; khi cần, app sẽ dời nhắc sang thời điểm phù hợp sau khoảng yên lặng.

Server Push (gợi ý): dùng OneSignal/FCM hoặc tự triển khai endpoint `/subscribe`, `/test` với thư viện `web-push`.

Biến môi trường client:

- `VITE_VAPID_PUBLIC_KEY` — khoá công khai VAPID (base64url)
- `VITE_PUSH_SERVER_URL` — URL server gửi push

---

## 7) Sao lưu & khôi phục

- Xuất JSON (tuỳ chọn xuất kèm cài đặt).
- Nhập JSON: hỗ trợ cả tệp 1 task; sau nhập, app tự lên lịch lại push notifications.

---

## 8) Hướng dẫn & phím tắt

- Hướng dẫn theo tab: Thêm nhanh, Tác vụ, Lọc/Sắp xếp/Tìm, AI, Thông báo, Cài đặt, Sao lưu, Phím tắt, Mẹo.
- Phím tắt (PC):
  - `/` → Tìm kiếm
  - `n` → Thêm công việc
  - `f` → Đổi bộ lọc
  - `g` → Cố vấn AI
  - `s` → Cài đặt
  - `b` → Bản tin hôm nay
  - `?` hoặc `Shift+/` → Hướng dẫn
  - `t` → Chế độ sáng/tối
  - `Ctrl+↑/↓` → Chuyển hạng mục
  - `Ctrl+1..9` → Nhảy nhanh đến hạng mục

---

## 9) PWA & triển khai

- PWA: có Service Worker, có thể cài như app trên desktop/mobile.
- Build: `npm run build` → xuất ra thư mục `dist/`.
- Triển khai: Netlify/Vercel hoặc máy chủ tĩnh có HTTPS.

---

## 10) Giới hạn & lưu ý

- AI chỉ hoạt động khi có `VITE_AI_API_KEY`; tuỳ hạn mức tài khoản API.
- Push cần HTTPS và server hợp lệ; trên HTTP thông báo có thể không hoạt động.
- Dữ liệu lưu cục bộ: nếu xoá cache/storage trình duyệt sẽ mất dữ liệu (hãy dùng Xuất/nhập để sao lưu).
