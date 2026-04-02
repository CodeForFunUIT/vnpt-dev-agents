# MCP Jira Agent — MCP Server

AI Dev Agent tích hợp Jira.

## 🚀 Cài đặt

```bash
# 1. Cài dependencies
npm install

# 2. Tạo file .env
cp .env.example .env
# → Mở file .env và điền cấu hình JIRA hoặc dùng AI Tool để thêm sau.

# 3. Build phần Core
npm run build
```

## 🔑 Quản lý Jira Personal Access Token (PAT)

1. Đăng nhập vào Jira Server
2. Click vào **avatar** góc trên phải → **Profile**
3. Chọn tab **Personal Access Tokens** → **Create Token**
4. Ở lần đầu, bạn có thể dán thủ công vào `.env`. 
5. Sau này khi token hết hạn, Agent có sẵn tính năng `manage_jira_pat`. Bạn chỉ cần chat yêu cầu hệ thống thay mới PAT, AI sẽ tự động cập nhật token một cách an toàn mà không cần mở sửa file `.env`.

> ⚠️ Token chỉ hiển thị 1 lần, hãy lưu trữ kỹ!

## ⚙️ Cấu hình MCP Client (Cursor, Roo, Claude Desktop, Antigravity)

Hệ thống hỗ trợ **2 cách** cấu hình biến môi trường, **ưu tiên Cách 1**:

### Cách 1: Truyền `env` trong MCP Client config (✅ Khuyên dùng)

Thêm block `"env"` trực tiếp vào file cấu hình MCP Client. Đây là **chuẩn chính thức MCP Protocol**, hoạt động bất kể thư mục làm việc hiện tại là gì.

```json
{
  "mcpServers": {
    "mcp-jira": {
      "command": "node",
      "args": ["<path-to-project>/dist/index.js"],
      "env": {
        "JIRA_BASE_URL": "https://your-jira-server.example.com",
        "JIRA_PAT": "YOUR_PERSONAL_ACCESS_TOKEN",
        "JIRA_DEFAULT_PROJECT": "MYPROJECT"
      }
    }
  }
}
```

> ⚠️ **Bảo mật:** File config MCP thường nằm ở thư mục cá nhân ($HOME) và không được commit lên Git, nên việc đặt PAT ở đây là an toàn.

### Cách 2: Dùng file `.env` (Fallback cho local dev)

```bash
cp .env.example .env
# → Mở file .env và điền cấu hình JIRA
```

> 💡 **Thứ tự ưu tiên:** env từ MCP Client config → `.env` file → lỗi khởi động.
> Nếu đã set env trong MCP config, `.env` file sẽ **không** ghi đè.

*Lưu ý: Thay thế `<path-to-project>` bằng đường dẫn tuyệt đối chuẩn xác tới thư mục dự án của bạn.*


## 🧪 Debug & Test thử các Tools tự tạo

Tốt nhất nên test tool MCP độc lập với giao diện Web (MCP Inspector) bằng lệnh:
```bash
npm run inspect
```
Mở đường dẫn trình duyệt hệ thống cung cấp (thường là `http://localhost:5173`). Tại đây bạn click List Tools và xem raw JSON để check bugs.

## 📋 Danh sách công cụ (Phase 1)

| Tool | Mô tả |
|------|-------|
| `list_my_open_issues` | Lấy danh sách task OPEN của bạn |
| `get_issue_detail` | Đọc chi tiết 1 issue |
| `log_work` | Logwork thời gian lên issue |
| `update_issue_status` | Chuyển trạng thái issue |
| `get_available_transitions` | Xem các transition có thể làm |
| `create_issue` | Tạo issue mới (Task/Sub-task/Bug) |
| `manage_jira_pat` | Xem và Cập nhật Personal Access Token ngay từ chat |

## 💬 Ví dụ câu lệnh giao tiếp AI Chat

Sau khi tích hợp xong, bạn có thể chat với MCP Client (Claude/Gemini/v.v):

```
"Cho tôi xem danh sách task OPEN của tôi trong project MYPROJ"

"Đọc chi tiết task PROJ-123 và phân tích tôi cần làm gì"

"Logwork 2h30m cho task PROJ-123, đã implement API endpoint login"

"Chuyển task PROJ-123 sang trạng thái In Review"

"Quản lý PAT của tôi" / "Cập nhật PAT thành abcxyz"
```

## 🗺️ Roadmap

- **Phase 1** ✅ Jira CRUD + logwork + PAT Management
- **Phase 2** 🔧 Generate code với context codebase
- **Phase 3** 🔀 SCM integration (tạo branch, MR)
- **Phase 4** 📄 Tạo sub-tasks từ file .md
