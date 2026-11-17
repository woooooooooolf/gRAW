import { readFileSync } from "node:fs";

const notes = readFileSync(new URL("../RELEASE_NOTES.md", import.meta.url), "utf8");
const headings = ["## Changed", "## Fixed", "## Docs"];
let section = -1;
let items = 0;

for (const [index, rawLine] of notes.split(/\r?\n/).entries()) {
  const line = rawLine.trim();
  if (!line) continue;
  if (headings.includes(line)) {
    if (line !== headings[section + 1] || (section >= 0 && items === 0)) {
      throw new Error(`RELEASE_NOTES.md:${index + 1}: 按 Changed、Fixed、Docs 顺序编写小标题，每节至少包含一个列表项。`);
    }
    section += 1;
    items = 0;
  } else if (section >= 0 && /^[-*+]\s+\S/.test(line)) {
    items += 1;
  } else {
    throw new Error(`RELEASE_NOTES.md:${index + 1}: 正文仅允许三个规定的小标题和 Markdown 无序列表，不要添加主标题或其他段落。`);
  }
}

if (section !== headings.length - 1 || items === 0) {
  throw new Error("RELEASE_NOTES.md: 必须包含 Changed、Fixed、Docs 三节，每节至少一个列表项；无修改时写“暂无。”。");
}
if (!/[\u3400-\u9fff]/u.test(notes)) {
  throw new Error("RELEASE_NOTES.md: 更新说明正文应使用简体中文，关键名称和缩写保留英文。");
}
console.log("发布说明格式检查通过；发布前仍需人工确认简体中文表述及修改点准确性。");
