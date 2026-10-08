// components/shared/RichTextEditor/constants.ts

/** 自动保存间隔（30秒） */
export const AUTO_SAVE_INTERVAL = 30 * 1000;

/** 草稿保存间隔（2秒防抖） */
export const DRAFT_SAVE_INTERVAL = 2000;

/** 草稿过期天数 */
export const DRAFT_EXPIRY_DAYS = 7;

/** 草稿 LocalStorage 键名前缀 */
export const DRAFT_KEY_PREFIX = 'bnoa_editor_draft_';

/** 版本列表每页数量 */
export const VERSION_LIST_PAGE_SIZE = 20;

/** 编辑器默认占位符 */
export const EDITOR_PLACEHOLDER = '开始编写内容...';

/** 简化版编辑器默认占位符 */
export const SIMPLE_EDITOR_PLACEHOLDER = '请输入内容...';
