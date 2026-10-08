export interface Role {
  id: string;
  code: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoleListResponse {
  nodes: Role[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface RoleListApiResponse {
  success: boolean;
  message: string;
  data: Role[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface CreateRoleRequest {
  code: string;
  name: string;
  description?: string;
  permissionIds?: string[];
}

export interface UpdateRoleRequest {
  name?: string;
  description?: string;
  permissionIds?: string[];
}
