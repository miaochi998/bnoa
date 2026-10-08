export interface SystemConfig {
  id: string;
  key: string;
  value: string;
  category: string;
  description?: string;
  isSystem: boolean;
  isEncrypted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ConfigListResponse {
  items: SystemConfig[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface ConfigFilter {
  category?: string;
  keyword?: string;
}

export interface CreateConfigRequest {
  key: string;
  value: string;
  category: string;
  description?: string;
}

export interface UpdateConfigRequest {
  value?: string;
  description?: string;
}
