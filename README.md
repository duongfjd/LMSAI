<div align="center">
  <img width="1200" height="400" alt="TLU Smart Learning Banner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" style="border-radius: 16px; object-fit: cover;" />
  
  <br/>
  <br/>

  # 🎓 TLU Smart Learning (LMSAI)
  
  **Cổng Học Tập Trực Tuyến Tích Hợp AI** <br/>
  *Được thiết kế riêng biệt với các tính năng quản lý học tập thông minh, trợ lý AI và tối ưu hóa quy trình chấm điểm.*

  <p align="center">
    <a href="#tính-năng-nổi-bật">Tính năng</a> •
    <a href="#công-nghệ-sử-dụng">Công nghệ</a> •
    <a href="#cài-đặt-phát-triển">Cài đặt</a> •
    <a href="#tính-năng-tích-hợp-excel-thông-minh">Excel Automation</a>
  </p>
</div>

---

## 🌟 Tính năng nổi bật

### 👥 Phân quyền người dùng đa cấp (RBAC)
- **Quản trị viên (Admin):** Quản lý người dùng, cài đặt hệ thống và theo dõi hiệu suất tổng thể.
- **Giảng viên (Teacher):** Tạo bài tập, bộ câu hỏi trắc nghiệm (Quiz), chấm điểm, và xuất/nhập điểm tự động qua Excel.
- **Sinh viên (Student):** Làm bài kiểm tra, nộp bài tập, theo dõi điểm số và nhận tư vấn lộ trình học từ AI.

### 🤖 Tích hợp Trí Tuệ Nhân Tạo (AI)
- **AI Phân tích học tập:** Theo dõi tiến độ học tập, điểm số của sinh viên để đưa ra nhận xét, cảnh báo và lộ trình cải thiện cá nhân hóa.
- **Trợ lý AI chuyên ngành:** Hỗ trợ giải đáp thắc mắc, phân tích tài liệu sâu sắc (tối ưu hóa cho các môn học như Chính trị Mác-Lênin).

### ⚡ Quản lý Bài tập & Thi trắc nghiệm (Quiz)
- Tạo bài trắc nghiệm với giao diện thời gian thực.
- Nộp bài tập dưới nhiều định dạng file (có hỗ trợ tự động nén dung lượng ảnh).
- Tải xuống toàn bộ bài nộp của sinh viên dưới dạng file `.zip` chỉ với 1 click.

### 📊 Tính năng tích hợp Excel thông minh (Smart Excel Auto-grading)
- **Máy quét tiêu đề thông minh:** Tự động định vị các cột siêu dữ liệu (`Họ tên`, `MSV`) bỏ qua các hàng header rác/logo.
- **Thuật toán đối sánh kép (Two-factor matching):** Ưu tiên khớp theo **Mã Sinh Viên (MSV)**, fallback sang **Họ & Tên** đảm bảo độ chính xác tuyệt đối.
- **Chấm điểm & Sao chép định dạng (Grid Layout):** Tự động chuyển đổi kết quả Quiz sang thang điểm 10. Các ô trống và chưa nộp bài vẫn được kế thừa 100% định dạng (border, màu sắc, font) từ các cột bên cạnh bằng thuật toán sao chép sâu (`JSON.parse(JSON.stringify(style))`).

---

## 💻 Công nghệ sử dụng

Dự án được xây dựng trên các công nghệ web hiện đại, chú trọng vào hiệu suất và trải nghiệm người dùng (UX/UI):

- **Core:** React 18, TypeScript, Vite
- **Styling & UI:** Tailwind CSS, Framer Motion (Animations), Lucide React (Icons)
- **Backend & Database:** Firebase (Authentication, Firestore, Storage)
- **Tiện ích (Utilities):** 
  - `exceljs`: Đọc/ghi, xử lý logic bảng tính Excel phức tạp.
  - `jszip` & `file-saver`: Hỗ trợ nén và tải xuống thư mục tự động.

---

## 🚀 Cài đặt phát triển (Run Locally)

Làm theo các bước dưới đây để thiết lập môi trường chạy thử hệ thống trên máy tính cá nhân của bạn:

### Yêu cầu hệ thống (Prerequisites)
- [Node.js](https://nodejs.org/en/) (phiên bản v18 trở lên khuyến nghị)
- Trình quản lý gói `npm` hoặc `yarn`.

### Các bước cài đặt

**1. Sao chép dự án**
```bash
git clone git@github.com:duongfjd/LMSAI.git
cd LMSAI
```

**2. Cài đặt các thư viện phụ thuộc**
```bash
npm install
```

**3. Thiết lập biến môi trường**
- Đổi tên tệp `.env.example` thành `.env.local` hoặc `.env`.
- Cập nhật các key tương ứng của Firebase và Gemini API:
```env
VITE_GEMINI_API_KEY=your_gemini_api_key_here
VITE_FIREBASE_API_KEY=your_firebase_api_key
# ... (các cấu hình firebase khác)
```

**4. Chạy ứng dụng**
```bash
npm run dev
```
Ứng dụng sẽ khả dụng tại địa chỉ: `http://localhost:5173/`

---

## 📜 Giấy phép
Bản quyền © Đại học Thủy Lợi (TLU). Được phát triển cho mục đích học thuật và quản lý đào tạo.
