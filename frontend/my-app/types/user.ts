export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  DELETED = 'DELETED',
}

export type SortOrder = 'asc' | 'desc';

export interface UserSortOption {
  field: 'createdAt' | 'lastLoginAt';
  order: SortOrder;
}

export interface User {
  id: string;
  username: string;
  email: string;
  name: string;
  phone?: string;
  avatar?: string;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  roles: string[];
}

export interface UserListResponse {
  nodes: User[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface UserFilter {
  keyword?: string;
  status?: UserStatus;
  roleId?: string;
  sortBy?: 'createdAt' | 'lastLoginAt';
  sortOrder?: SortOrder;
}

export interface PageInput {
  page: number;
  pageSize: number;
}

export interface CreateUserRequest {
  username: string;
  email?: string;
  password: string;
  name?: string;
  phone?: string;
  avatar?: string;
  roleIds: string[];
}

export interface UpdateUserRequest {
  email?: string;
  name?: string;
  phone?: string;
  avatar?: string;
  status?: UserStatus;
  roleIds?: string[];
}

export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}
