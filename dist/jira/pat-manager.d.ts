/**
 * Đọc PAT hiện tại từ .env file
 * Trả về: { pat, envPath, exists }
 */
export declare function getCurrentPat(): {
    pat: string | null;
    envPath: string;
    exists: boolean;
    masked: string;
};
/**
 * Cập nhật PAT trong .env file
 * - Nếu JIRA_PAT= đã tồn tại → replace giá trị
 * - Nếu chưa có → append vào cuối
 * - Cập nhật process.env để session hiện tại dùng ngay
 */
export declare function updatePat(newPat: string): {
    envPath: string;
    previousMasked: string;
    newMasked: string;
    action: "updated" | "added";
};
/**
 * Validate PAT format cơ bản
 * PAT Jira Server thường là base64 string dài
 */
export declare function validatePat(pat: string): {
    valid: boolean;
    reason?: string;
};
//# sourceMappingURL=pat-manager.d.ts.map