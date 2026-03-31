export declare class JiraClient {
    private http;
    constructor();
    /**
     * Cập nhật PAT tại runtime — tạo lại axios instance
     * với Bearer token mới mà không cần restart server
     */
    updatePat(newPat: string): void;
    /**
     * Lấy danh sách issues theo JQL
     * JQL (Jira Query Language) cực kỳ mạnh, ví dụ:
     *   assignee = currentUser() AND status = Open
     *   project = VNPTAI AND sprint in openSprints()
     */
    searchIssues(jql: string, maxResults?: number): Promise<any>;
    /**
     * Lấy chi tiết 1 issue theo key (VD: VNPTAI-123)
     * Trả về toàn bộ: description, comments, attachments...
     */
    getIssue(issueKey: string): Promise<any>;
    /**
     * Logwork thời gian lên 1 issue
     * @param timeSpent - Jira format: "2h 30m", "1d", "45m"
     * @param comment   - Mô tả đã làm gì trong khoảng thời gian đó
     */
    addWorklog(issueKey: string, timeSpent: string, comment: string): Promise<any>;
    /**
     * Lấy danh sách transitions có thể thực hiện
     * Mỗi Jira project có workflow riêng nên cần
     * gọi API này trước để biết transitionId
     */
    getTransitions(issueKey: string): Promise<{
        id: string;
        name: string;
    }[]>;
    /**
     * Chuyển trạng thái issue
     * @param transitionName - VD: "In Progress", "In Review", "Done"
     *                         Sẽ tự động tìm ID tương ứng
     * @param resolution     - VD: "Done", "Fixed", "Won't Do". Gửi kèm khi chuyển sang Done/Resolved.
     * @param comment        - Ghi chú khi chuyển trạng thái.
     */
    transitionIssue(issueKey: string, transitionName: string, options?: {
        resolution?: string;
        comment?: string;
    }): Promise<{
        success: boolean;
        transitionedTo: string;
    }>;
    /**
     * Thêm comment vào issue
     */
    addComment(issueKey: string, body: string): Promise<any>;
    /**
     * Lấy danh sách field + allowed values cho việc tạo issue
     * Gọi endpoint QuickCreateIssue (VNPT Jira Server)
     * Response là JSON array với editHtml escaped — parse bằng regex
     */
    getCreateMeta(_projectKey: string, _issueTypeName: string): Promise<{
        projectId: string;
        projectKey: string;
        issueTypeId: string;
        issueTypeName: string;
        fields: Record<string, {
            name: string;
            required: boolean;
            schema: {
                type: string;
                custom?: string;
            };
            allowedValues?: Array<{
                id: string;
                value?: string;
                name?: string;
            }>;
        }>;
    }>;
    /**
     * Parse 1 field từ response QuickCreateIssue
     * Response chứa JSON: {"id":"fieldId","label":"...",editHtml":"...escaped HTML..."}
     * editHtml chứa <option value="id">text</option> dạng escaped
     */
    private parseFieldFromQuickCreate;
    /**
     * Lấy giá trị custom field từ một issue đã tồn tại
     * Dùng làm fallback khi createmeta chậm/không khả dụng
     */
    getCustomFieldFromIssue(issueKey: string, fieldIds: string[]): Promise<Record<string, {
        id: string;
        value: string;
    } | null>>;
    /**
     * Tạo issue mới
     * Hỗ trợ truyền custom field bằng value (tên) — sẽ tự resolve ID
     * Nếu truyền sai tên, API sẽ báo lỗi rõ ràng
     */
    createIssue(payload: {
        projectKey: string;
        summary: string;
        description: string;
        issueType: string;
        parentKey?: string;
        priority: string;
        labels: string[];
        spda: string;
        congDoan: string;
        dueDate: string;
        assignee?: string;
        epicKey?: string;
    }): Promise<any>;
    /**
     * Fallback: đọc custom field options từ issue gần nhất trong project
     * Nhanh hơn createmeta nhiều — chỉ cần 1 API call
     */
    private resolveOptionsFromExistingIssue;
    /**
     * Tìm option khớp nhất từ danh sách allowedValues
     * So sánh: exact match → lowercase match → contains match
     */
    private findBestOption;
    /**
     * Wrapper của findBestOption với error message thông minh:
     * - Nếu match → trả về { id, value }
     * - Nếu không match → throw lỗi kèm top-3 gợi ý ranked by similarity
     * @param fieldLabel - Tên field hiển thị trong error, VD: "Mã SPDA"
     */
    private resolveCustomFieldOption;
    /**
     * Lấy danh sách users có thể assign cho project
     * Jira Server endpoint: /user/assignable/search
     */
    getAssignableUsers(projectKey: string): Promise<{
        key: string;
        name: string;
        displayName: string;
        emailAddress?: string;
    }[]>;
    /**
     * Tìm danh sách Epic đang mở trong project
     * Dùng để hiển thị gợi ý khi tạo issue mới
     */
    searchEpics(projectKey: string): Promise<{
        key: string;
        fields: {
            summary: string;
            status: {
                name: string;
            };
        };
    }[]>;
    /**
     * Fuzzy-resolve assignee username từ danh sách assignable users.
     * Ưu tiên: exact name → exact displayName → contains name/displayName/email
     * Nếu không tìm thấy → throw error kèm top-3 gợi ý gần nhất.
     */
    private resolveAssignee;
    /**
     * Fuzzy-resolve Epic key từ danh sách epics đang mở.
     * Ưu tiên: exact key → contains key → contains summary
     * Nếu không tìm thấy → throw error kèm top-3 gợi ý gần nhất.
     */
    private resolveEpicKey;
    /**
     * Tính độ tương đồng đơn giản giữa 2 chuỗi (0-1)
     * Dùng để sắp xếp gợi ý khi fuzzy match không ra kết quả
     */
    private calcSimilarity;
}
export declare const jiraClient: JiraClient;
//# sourceMappingURL=client.d.ts.map