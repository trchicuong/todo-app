## Deploy lên Netlify

Triển khai trực tiếp từ GitHub, Netlify sẽ build static site và Functions.

1. Kết nối repo với Netlify

- Vào https://app.netlify.com → Add new site → Import an existing project → chọn repository.
- Build command: `npm run build`
- Publish directory: `dist`
- Functions directory: lấy từ `netlify.toml` (đã cấu hình `netlify/functions`).

2. Thiết lập biến môi trường (Site settings → Build & deploy → Environment)

- Server (Functions):
  - `VAPID_PUBLIC_KEY` = khoá công khai VAPID
  - `VAPID_PRIVATE_KEY` = khoá bí mật VAPID
- Client (Vite):
  - `VITE_VAPID_PUBLIC_KEY` = cùng giá trị với `VAPID_PUBLIC_KEY`
  - `VITE_PUSH_SERVER_URL=/.netlify/functions` (để app gọi các functions nội bộ)
  - (Tuỳ chọn) `VITE_AI_API_KEY` = Google Generative Language API key
  - (Tuỳ chọn) `VITE_AI_MODEL` = ví dụ `models/gemini-2.5-flash`

3. Tạo VAPID keys (nếu chưa có)

```powershell
npx web-push generate-vapid-keys
# Kết quả ví dụ:
# Public Key:  BExxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# Private Key: FJyyyyyyyyyyyyyyyyyyyyyyyyyyyy
```

Điền Public/Private tương ứng vào biến môi trường ở bước 2.

4. Redirect cho trang Dashboard

- File `netlify.toml` đã có rule:

```toml
[[redirects]]
  from = "/dashboard"
  to = "/dashboard.html"
  status = 200
```

Netlify sẽ phục vụ `/dashboard.html` khi thông báo đẩy mở đường dẫn `/dashboard`.

5. Deploy

- Nhấn “Deploy site”. Sau khi build xong, mở site → vào Cài đặt → bật Push → bấm “Gửi thử”.

Ghi chú SPA: nếu bạn có route ảo, có thể bật fallback về `index.html` (xem block redirects được comment trong `netlify.toml`).
