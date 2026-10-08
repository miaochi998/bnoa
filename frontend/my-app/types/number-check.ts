export interface NumberCheckRecord {
  id: string;
  code: string;
  batchNo: string;
  importedAt: string;
  isSettled: boolean;
  remark: string | null;
  status: 'ACTIVE' | 'VOID';
  repeatCount?: number;
  hasFile?: boolean;
  history?: NumberCheckRecord[];
}

export interface DedupMatch {
  id: string;
  code: string;
  batchNo: string;
  importedAt: string;
  isSettled: boolean;
  remark: string | null;
  status: string;
}

export interface DedupResultItem {
  code: string;
  result: 'repeat' | 'not_repeat' | 'empty';
  intraBatchDuplicate: boolean;
  matches: DedupMatch[];
}

export interface DedupSummary {
  total: number;
  repeat: number;
  notRepeat: number;
  empty: number;
}

export interface ImportSheet {
  name: string;
  totalRows: number;
  previewRows: string[][];
  suggestedColumnIndex: number;
  suggestedHasHeader: boolean;
}
