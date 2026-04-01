import { z } from "zod";
import { jiraClient } from "../jira/client.js";
import { withErrorHandler, getChainHint } from "../shared/index.js";
export function registerParserTools(server) {
    // ── TOOL: Parse description ───────────────────
    server.tool("parse_description", "Đọc và parse description của một Jira issue theo format chuẩn. " +
        "Trích xuất [AI_METADATA], scenarios, done_when checklist và phân tích " +
        "quality signals để tự động chuẩn bị context cho các tools khác. " +
        "Dùng đầu tiên khi nhận task mới — thay thế việc đọc description thủ công.", {
        issueKey: z.string().describe("Jira issue key"),
    }, withErrorHandler("parse_description", async ({ issueKey }) => {
        const issue = await jiraClient.getIssue(issueKey);
        const description = issue.fields.description ?? "";
        const summary = issue.fields.summary ?? "";
        const issueType = issue.fields.issuetype?.name ?? "Task";
        const parsed = parseDescription(description);
        return {
            content: [{
                    type: "text",
                    text: formatParsedResult(issueKey, summary, issueType, parsed) + getChainHint("parse_description"),
                }],
        };
    }));
    // ── TOOL: Validate format compliance ─────────
    server.tool("check_format_compliance", "Kiểm tra description của task có đúng format chuẩn không. " +
        "Trả về danh sách sections còn thiếu, ước tính grade chất lượng, " +
        "và hướng dẫn cụ thể để hoàn thiện. " +
        "Chạy trước khi giao AI implement để đảm bảo input chất lượng cao.", {
        issueKey: z.string().describe("Jira issue key"),
    }, withErrorHandler("check_format_compliance", async ({ issueKey }) => {
        const issue = await jiraClient.getIssue(issueKey);
        const description = issue.fields.description ?? "";
        const issueType = issue.fields.issuetype?.name ?? "Task";
        const parsed = parseDescription(description);
        const qs = parsed.qualitySignals;
        // Required sections per type
        const required = {
            Task: ["WHY", "WHAT", "WHERE", "HOW", "SCENARIOS", "DONE_WHEN", "AI_METADATA"],
            Bug: ["BUG_SUMMARY", "REPRODUCE", "EXPECTED", "ACTUAL", "WHERE", "DONE_WHEN", "AI_METADATA"],
            Story: ["USER_STORY", "SCOPE", "ACCEPTANCE_CRITERIA", "AI_METADATA"],
            "Sub-task": ["PARENT", "CONTEXT", "WHAT", "WHERE", "SCENARIOS", "DONE_WHEN", "AI_METADATA"],
        };
        const requiredForType = required[issueType] ?? required["Task"];
        const missing = requiredForType.filter((s) => !qs.hasSections.includes(s));
        const present = requiredForType.filter((s) => qs.hasSections.includes(s));
        // Grade calculation
        const completionRate = present.length / requiredForType.length;
        const grade = completionRate >= 0.95 && qs.scenarioCount >= 3 && qs.hasMetadata ? "A" :
            completionRate >= 0.8 && qs.scenarioCount >= 2 && qs.hasMetadata ? "B" :
                completionRate >= 0.6 && qs.scenarioCount >= 1 ? "C" :
                    completionRate >= 0.4 ? "D" : "F";
        const gradeEmoji = {
            A: "🟢", B: "🔵", C: "🟡", D: "🟠", F: "🔴"
        };
        const lines = [
            `# 📋 Format Compliance — ${issueKey}`,
            `**Type:** ${issueType}`,
            "",
            `## ${gradeEmoji[grade]} Grade: ${grade}  (${present.length}/${requiredForType.length} sections)`,
            "",
        ];
        if (present.length > 0) {
            lines.push("## ✅ Sections đã có");
            present.forEach((s) => lines.push(`  - [${s}]`));
            lines.push("");
        }
        if (missing.length > 0) {
            lines.push("## ❌ Sections còn thiếu — cần thêm vào");
            missing.forEach((s) => lines.push(`  - **[${s}]** — ${getSectionHint(s)}`));
            lines.push("");
        }
        // Specific quality feedback
        if (qs.scenarioCount === 0) {
            lines.push("⚠️ **Không có scenario GWT** — AI không biết đâu là expected behavior");
        }
        else if (qs.scenarioCount < 3) {
            lines.push(`⚠️ **Chỉ có ${qs.scenarioCount} scenario** — nên có ít nhất 3 (happy path + error + edge case)`);
        }
        if (qs.doneWhenCount === 0) {
            lines.push("⚠️ **Không có Done When checklist** — AI không biết khi nào thì xong");
        }
        if (!qs.hasMetadata) {
            lines.push("⚠️ **Thiếu [AI_METADATA]** — tools sẽ không tự động pre-fill được params");
        }
        lines.push("");
        if (grade === "F" || grade === "D") {
            lines.push("---", `💡 **Gợi ý:** Dùng \`generate_gwt_description\` để AI tự động sinh description chuẩn từ mô tả hiện tại.`);
        }
        else if (grade === "A" || grade === "B") {
            lines.push("---", `✅ **Sẵn sàng!** Description đủ tốt. Tiếp theo: chạy \`evaluate_task_complexity\` để đánh giá effort.`);
        }
        return {
            content: [{ type: "text", text: lines.join("\n") + getChainHint("check_format_compliance") }],
        };
    }));
}
// ─────────────────────────────────────────────
// Parser Engine
// ─────────────────────────────────────────────
function parseDescription(raw) {
    const hasSections = [];
    const lines = raw.split("\n");
    // Detect sections
    const sectionPattern = /^## \[([A-Z_]+)\]/;
    const sections = new Map();
    let currentSection = null;
    for (const line of lines) {
        const match = line.match(sectionPattern);
        if (match) {
            currentSection = match[1];
            sections.set(currentSection, []);
            hasSections.push(currentSection);
        }
        else if (currentSection) {
            sections.get(currentSection).push(line);
        }
    }
    // Parse [AI_METADATA]
    const metaLines = sections.get("AI_METADATA") ?? [];
    const metadata = parseMetadata(metaLines);
    // Parse scenarios
    const scenarioLines = sections.get("SCENARIOS") ?? [];
    const scenarios = parseScenarios(scenarioLines) ?? [];
    // Parse done_when checklist
    const doneLines = sections.get("DONE_WHEN") ?? [];
    const doneWhen = doneLines
        .filter((l) => l.trim().startsWith("- [ ]") || l.trim().startsWith("- [x]"))
        .map((l) => l.replace(/^- \[[ x]\] /, "").trim())
        .filter(Boolean);
    // Parse WHERE
    const whereLines = sections.get("WHERE") ?? [];
    const where = parseWhere(whereLines);
    // Parse HOW
    const howLines = sections.get("HOW") ?? [];
    const how = howLines
        .filter((l) => l.trim().startsWith("-"))
        .map((l) => l.replace(/^- /, "").trim())
        .filter(Boolean);
    // Quality signals
    const requiredAll = ["WHERE", "HOW", "SCENARIOS", "DONE_WHEN", "AI_METADATA"];
    const missingSections = requiredAll.filter((s) => !hasSections.includes(s));
    const estimatedGrade = (() => {
        if (hasSections.length >= 6 && scenarios.length >= 3 && doneWhen.length >= 3 && metadata.tags.length > 0)
            return "A";
        if (hasSections.length >= 4 && scenarios.length >= 2 && doneWhen.length >= 1)
            return "B";
        if (hasSections.length >= 3 && scenarios.length >= 1)
            return "C";
        if (hasSections.length >= 2)
            return "D";
        return "F";
    })();
    return {
        why: extractSection(sections, "WHY"),
        what: extractSection(sections, "WHAT"),
        where,
        how,
        scenarios,
        doneWhen,
        bugSummary: extractSection(sections, "BUG_SUMMARY"),
        reproduce: sections.get("REPRODUCE")
            ?.filter((l) => /^\d+\./.test(l.trim()))
            .map((l) => l.replace(/^\d+\. /, "").trim()),
        expected: extractSection(sections, "EXPECTED"),
        actual: extractSection(sections, "ACTUAL"),
        userStory: extractSection(sections, "USER_STORY"),
        metadata,
        qualitySignals: {
            hasSections,
            missingSections,
            scenarioCount: scenarios.length,
            doneWhenCount: doneWhen.length,
            hasMetadata: hasSections.includes("AI_METADATA"),
            estimatedGrade,
        },
    };
}
function parseMetadata(lines) {
    const get = (key) => {
        const line = lines.find((l) => l.trim().startsWith(`${key}:`));
        return line ? line.split(":").slice(1).join(":").trim() : "";
    };
    const tagsRaw = get("tags");
    const tags = tagsRaw
        .replace(/[\[\]]/g, "")
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t && !t.startsWith("VD:"));
    const relatedRaw = get("related_issues");
    const relatedIssues = relatedRaw
        .replace(/[\[\]]/g, "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    return {
        type: get("type") || "Task",
        featureType: get("feature_type") || undefined,
        tags,
        sprint: get("sprint") || undefined,
        estimatedComplexity: get("estimated_complexity") || undefined,
        securitySensitive: get("security_sensitive") === "true",
        severity: get("severity") || undefined,
        relatedIssues: relatedIssues.length > 0 ? relatedIssues : undefined,
        parentKey: get("parent_key") || undefined,
    };
}
function parseScenarios(lines) {
    const scenarios = [];
    let current = null;
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("### Scenario")) {
            if (current)
                scenarios.push(current);
            current = { name: trimmed.replace(/^### Scenario \d+: /, ""), given: "", when: "", then: [] };
        }
        else if (trimmed.startsWith("**Given**") && current) {
            current.given = trimmed.replace("**Given**", "").trim();
        }
        else if (trimmed.startsWith("**When**") && current) {
            current.when = trimmed.replace("**When**", "").trim();
        }
        else if (trimmed.startsWith("**Then**") && current) {
            current.then.push(trimmed.replace("**Then**", "").trim());
        }
        else if (current && current.then.length > 0 && trimmed && !trimmed.startsWith("**")) {
            current.then.push(trimmed); // Multi-line Then
        }
    }
    if (current)
        scenarios.push(current);
    return scenarios;
}
function parseWhere(lines) {
    const get = (prefix) => {
        const line = lines.find((l) => l.includes(prefix));
        return line ? line.split("`")[1] : undefined;
    };
    return {
        module: get("Module:"),
        component: get("Component:"),
        service: get("Service:"),
        api: get("API:"),
    };
}
function extractSection(sections, key) {
    const lines = sections.get(key);
    if (!lines)
        return undefined;
    return lines
        .filter((l) => l.trim() && !l.trim().startsWith("<!--"))
        .join("\n")
        .trim() || undefined;
}
function getSectionHint(section) {
    const hints = {
        WHY: "1 câu lý do nghiệp vụ — tại sao cần tính năng này",
        WHAT: "Mô tả cụ thể cần làm gì",
        WHERE: "Module, Component, Service, API endpoint",
        HOW: "Ràng buộc kỹ thuật, pattern cần follow",
        SCENARIOS: "Ít nhất 3 GWT: happy path, error case, edge case",
        DONE_WHEN: "Checklist cụ thể để verify task xong",
        AI_METADATA: "type, tags, sprint, security_sensitive",
        BUG_SUMMARY: "1 câu mô tả bug ngắn gọn",
        REPRODUCE: "Các bước tái hiện bug theo số thứ tự",
        EXPECTED: "Hành vi đúng phải là gì",
        ACTUAL: "Hành vi sai đang xảy ra",
        USER_STORY: "Với tư cách là [role], tôi muốn [feature] để [benefit]",
        SCOPE: "In scope và Out of scope rõ ràng",
        ACCEPTANCE_CRITERIA: "Tiêu chí chấp nhận high-level",
        PARENT: "Key của parent Story/Task",
        CONTEXT: "2-3 câu tóm tắt context từ parent",
    };
    return hints[section] ?? "Xem DESCRIPTION_TEMPLATES.md để biết cách điền";
}
// ─────────────────────────────────────────────
// Output formatter
// ─────────────────────────────────────────────
function formatParsedResult(issueKey, summary, issueType, parsed) {
    const qs = parsed.qualitySignals;
    const gradeEmoji = { A: "🟢", B: "🔵", C: "🟡", D: "🟠", F: "🔴" };
    const lines = [
        `# 🔍 Parsed Description — ${issueKey}`,
        `**${summary}**  |  Type: ${issueType}`,
        "",
        `## ${gradeEmoji[qs.estimatedGrade]} Format Quality: ${qs.estimatedGrade}`,
        `Sections: ${qs.hasSections.join(" · ") || "none"}`,
        `Scenarios: ${qs.scenarioCount} | Done When: ${qs.doneWhenCount} items | Metadata: ${qs.hasMetadata ? "✅" : "❌"}`,
        "",
    ];
    // WHY
    if (parsed.why) {
        lines.push("## Mục tiêu nghiệp vụ", parsed.why, "");
    }
    // WHERE — quan trọng nhất cho tools
    if (parsed.where?.component || parsed.where?.service || parsed.where?.api) {
        lines.push("## Vị trí codebase");
        if (parsed.where.module)
            lines.push(`- Module: \`${parsed.where.module}\``);
        if (parsed.where.component)
            lines.push(`- Component: \`${parsed.where.component}\``);
        if (parsed.where.service)
            lines.push(`- Service: \`${parsed.where.service}\``);
        if (parsed.where.api)
            lines.push(`- API: \`${parsed.where.api}\``);
        lines.push("");
    }
    // Scenarios summary
    if (parsed.scenarios && parsed.scenarios.length > 0) {
        lines.push(`## Scenarios (${parsed.scenarios.length})`);
        parsed.scenarios.forEach((s, i) => {
            lines.push(`${i + 1}. **${s.name}**`);
        });
        lines.push("");
    }
    // Done When
    if (parsed.doneWhen && parsed.doneWhen.length > 0) {
        lines.push(`## Done When (${parsed.doneWhen.length} items)`);
        parsed.doneWhen.forEach((d) => lines.push(`- [ ] ${d}`));
        lines.push("");
    }
    // AI Metadata — structured output cho tools
    lines.push("## AI Metadata (auto-extracted)");
    lines.push(`\`\`\`json\n${JSON.stringify(parsed.metadata, null, 2)}\n\`\`\``);
    lines.push("");
    // Next steps dựa trên quality
    lines.push("## Bước tiếp theo");
    if (qs.estimatedGrade === "F" || qs.estimatedGrade === "D") {
        lines.push("1. Chạy `generate_gwt_description` để AI sinh description đầy đủ");
        lines.push("2. Hoặc thêm các sections còn thiếu theo DESCRIPTION_TEMPLATES.md");
    }
    else {
        if (parsed.metadata.securitySensitive) {
            lines.push("1. 🚨 `check_security_flag` — task có security_sensitive: true");
        }
        lines.push(`${parsed.metadata.securitySensitive ? "2" : "1"}. \`evaluate_task_complexity\` — đánh giá effort`);
        lines.push(`${parsed.metadata.securitySensitive ? "3" : "2"}. \`detect_files_from_task\` — tìm file context`);
        lines.push(`${parsed.metadata.securitySensitive ? "4" : "3"}. Implement!`);
    }
    return lines.join("\n");
}
//# sourceMappingURL=tools.js.map