import {
  IsString,
  IsArray,
  IsOptional,
  IsEnum,
  IsUUID,
  ArrayMinSize,
  ValidateIf,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SharePermission } from '@prisma/client';

/**
 * 共享文件夹 DTO
 */
export class ShareFolderDto {
  @ApiProperty({
    description: '共享给用户ID列表',
    example: ['user-id-1', 'user-id-2'],
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  userIds?: string[];

  @ApiProperty({
    description: '共享给角色ID列表（系统共享时使用）',
    example: ['role-id-1'],
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  roleIds?: string[];

  @ApiProperty({
    description: '权限列表',
    example: ['VIEW', 'DOWNLOAD'],
    enum: SharePermission,
    isArray: true,
  })
  @IsArray()
  @IsEnum(SharePermission, { each: true })
  @ArrayMinSize(1, { message: '至少需要指定一个权限' })
  permissions: SharePermission[];

  // 验证：至少指定一个共享对象
  @ValidateIf((o) => !o.userIds?.length && !o.roleIds?.length)
  @IsArray()
  @ArrayMinSize(1, { message: '请指定至少一个共享对象（用户或角色）' })
  _validateTarget?: string[];
}

/**
 * 更新共享权限 DTO
 */
export class UpdateSharePermissionDto {
  @ApiProperty({
    description: '权限列表',
    example: ['VIEW', 'DOWNLOAD', 'UPLOAD'],
    enum: SharePermission,
    isArray: true,
  })
  @IsArray()
  @IsEnum(SharePermission, { each: true })
  @ArrayMinSize(1, { message: '至少需要指定一个权限' })
  permissions: SharePermission[];
}

/**
 * 创建系统共享文件夹 DTO
 */
export class CreateSystemSharedFolderDto {
  @ApiProperty({
    description: '文件夹名称',
    example: '公司制度文件',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: '文件夹描述',
    example: '存放公司制度相关文件',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: '文件夹图标',
    example: 'building',
    required: false,
  })
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiProperty({
    description: '关联的真实文件夹ID',
    example: 'real-folder-uuid',
  })
  @IsUUID()
  realFolderId: string;

  @ApiProperty({
    description: '可访问的角色ID列表',
    example: ['role-id-1', 'role-id-2'],
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1, { message: '至少需要指定一个角色' })
  roleIds: string[];

  @ApiProperty({
    description: '默认权限列表',
    example: ['VIEW', 'DOWNLOAD'],
    enum: SharePermission,
    isArray: true,
  })
  @IsArray()
  @IsEnum(SharePermission, { each: true })
  @ArrayMinSize(1, { message: '至少需要指定一个权限' })
  permissions: SharePermission[];
}
