# ✅ Todo App - Phần mềm quản lý công việc

Một dự án To-Do List hiện đại dành cho sinh viên, được xây dựng với Vite và JavaScript thuần. Tích hợp AI để nâng cao hiệu suất làm việc và có thể cài đặt như một ứng dụng độc lập (PWA).

> **[Xem Demo trực tiếp](https://todo.trchicuong.id.vn/)**

---

### 📥 Tải về

**1. Yêu cầu:**
* Đã cài đặt [Node.js](https://nodejs.org/) (phiên bản 18.x trở lên).

**2. Clone từ GitHub:**
```bash
git clone https://github.com/trchicuong/todo-app.git
cd todo-app
```
Hoặc tải file `.zip` trực tiếp từ repository.

---

### ⚙️ Cài đặt & Chạy

1.  **Cài đặt các gói phụ thuộc:**
    ```bash
    npm install
    ```

2.  **Thêm API Key:**
    - Đổi tên file `.env.example` ở thư mục gốc của dự án thành `.env`
    - Mở file `.env` thay thế `your_api_key` bằng API Key của bạn từ Google AI Studio:
      ```
      VITE_AI_API_KEY=your_api_key
      ```

3.  **Chạy server phát triển:**
    ```bash
    npm run dev
    ```

4.  **Truy cập trình duyệt:**
    Mở `http://localhost:5173` (hoặc cổng khác do Vite cung cấp).

5.  **Build dự án:**
```bash
npm run build
```

5.  **Deploy:**
Netlify, Vercel,...

---

### 📁 Cấu trúc thư mục

```
todo-app/
├── public/
│   ├── images/
│   └── sound/
├── src/
│   ├── css/
│   │   ├── input.css
│   │   └── ...
│   └── js/
│       ├── app.js
│       └── landing.js
├── .env.example
├── .gitignore
├── dashboard.html
├── index.html
├── LICENSE
├── package-lock.json
├── package.json
├── README.md
├── tailwind.config.js
└── vite.config.js
```
---

### 🤝 Đóng góp

Dự án này luôn chào đón các đóng góp! Nếu bạn muốn sửa lỗi, thêm một công cụ mới, hoặc cải thiện mã nguồn, hãy thoải mái tạo một `Pull Request`.

---

### ✉️ Góp ý & Liên hệ

Nếu bạn có bất kỳ ý tưởng nào để cải thiện công cụ hoặc phát hiện lỗi, đừng ngần ngại mở một `Issue` trên repo này.

Mọi thông tin khác, bạn có thể liên hệ với tôi qua:
[**trchicuong.id.vn**](https://trchicuong.id.vn/)