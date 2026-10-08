import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SharePermission } from '@prisma/client';
import { FolderPermissionService } from '../folder-permission.service';

/**
 * 权限元数据Key
 */
export const FOLDER_PERMISSION_KEY = 'folder_permission';

/**
 * 文件夹ID参数名元数据Key
 */
export const FOLDER_ID_PARAM_KEY = 'folder_id_param';

/**
 * 装饰器：要求指定的文件夹权限
 * @param permission 所需权限
 * @param folderIdParam 文件夹ID参数名，默认为 'id'
 */
export const RequireFolderPermission = (
  permission: SharePermission,
  folderIdParam: string = 'id',
) => {
  return (target: object, key: string | symbol, descriptor: PropertyDescriptor) => {
    SetMetadata(FOLDER_PERMISSION_KEY, permission)(target, key, descriptor);
    SetMetadata(FOLDER_ID_PARAM_KEY, folderIdParam)(target, key, descriptor);
  };
};

/**
 * 文件夹权限守卫
 * 根据装饰器配置检查用户是否有指定的文件夹权限
 */
@Injectable()
export class FolderPermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionService: FolderPermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.getAllAndOverride<SharePermission>(
      FOLDER_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    // 如果没有配置权限要求，则允许通过
    if (!requiredPermission) {
      return true;
    }

    const folderIdParam = this.reflector.getAllAndOverride<string>(
      FOLDER_ID_PARAM_KEY,
      [context.getHandler(), context.getClass()],
    ) || 'id';

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('未登录');
    }

    // 从路由参数、查询参数或请求体中获取文件夹ID
    const folderId =
      request.params[folderIdParam] ||
      request.query[folderIdParam] ||
      request.body[folderIdParam];

    if (!folderId) {
      throw new ForbiddenException('缺少文件夹ID');
    }

    const hasPermission = await this.permissionService.checkPermission(
      user.id,
      folderId,
      requiredPermission,
    );

    if (!hasPermission) {
      throw new ForbiddenException('没有操作该文件夹的权限');
    }

    return true;
  }
}
