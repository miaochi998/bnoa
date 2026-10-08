export enum PermissionType {
  MENU = 'MENU',
  BUTTON = 'BUTTON',
  API = 'API',
  DATA = 'DATA',
}

export interface Permission {
  id: string;
  name: string;
  code: string;
  type: PermissionType;
  parentId?: string;
  description?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  children?: Permission[];
}

export interface PermissionListResponse {
  nodes: Permission[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CreatePermissionRequest {
  name: string;
  code: string;
  type: PermissionType;
  parentId?: string;
  description?: string;
  sortOrder?: number;
}

export interface UpdatePermissionRequest {
  name?: string;
  description?: string;
  sortOrder?: number;
}

export interface PermissionFilter {
  keyword?: string;
  type?: PermissionType;
}

export interface PermissionTreeNode extends Permission {
  children: PermissionTreeNode[];
}
