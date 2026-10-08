import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  StreamableFile,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
}

interface PaginatedData<T> {
  data: T;
  meta: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, unknown> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<unknown> {
    return next.handle().pipe(
      map((data: T) => {
        // 如果是StreamableFile，直接返回，不进行包装
        if (data instanceof StreamableFile) {
          return data;
        }

        // 如果已经是标准格式，直接返回
        if (
          data &&
          typeof data === 'object' &&
          'success' in (data as Record<string, unknown>)
        ) {
          return data as unknown as Response<T>;
        }

        // 处理分页数据
        if (
          data &&
          typeof data === 'object' &&
          'data' in (data as Record<string, unknown>) &&
          'meta' in (data as Record<string, unknown>)
        ) {
          const paginatedData = data as unknown as PaginatedData<T>;
          return {
            success: true,
            message: '操作成功',
            data: paginatedData.data,
            meta: paginatedData.meta,
          };
        }

        return {
          success: true,
          message: '操作成功',
          data,
        };
      }),
    );
  }
}
