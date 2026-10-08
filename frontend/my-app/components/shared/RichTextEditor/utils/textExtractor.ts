// utils/textExtractor.ts

/**
 * 从 Tiptap JSON 中提取纯文本
 */
export function extractText(json: any): string {
    if (!json) return '';
    if (typeof json === 'string') return json;
    if (json.text) return json.text;
    if (json.content && Array.isArray(json.content)) {
        return json.content
            .map(extractText)
            .join('');
    }
    return '';
}

/**
 * 统计中文字符数
 */
export function countChineseChars(
    text: string
): number {
    const matches = text.match(
        /[\u4e00-\u9fff]/g
    );
    return matches ? matches.length : 0;
}

/**
 * 统计字数（中文按字计，英文按词计）
 */
export function countWords(text: string): number {
    const chinese = countChineseChars(text);
    const withoutChinese = text.replace(
        /[\u4e00-\u9fff]/g, ''
    );
    const english = withoutChinese
        .trim()
        .split(/\s+/)
        .filter(Boolean).length;
    return chinese + english;
}
