import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 创建文件夹 DTO
 */
export class CreateFolderDto {
  @ApiProperty({
    description: '文件夹名称',
    example: '我的文档',
  })
  @IsString()
  @IsNotEmpty({ message: '文件夹名称不能为空' })
  @MaxLength(100, { message: '文件夹名称不能超过100个字符' })
  name: string;

  @ApiProperty({
    description: '父文件夹ID（为空表示根目录）',
    example: '550e8400-e29b-41d4-a716-446655440000',
    required: false,
  })
  @IsString()
  @IsOptional()
  parentId?: string;

  @ApiProperty({
    description: '映射的真实文件夹ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
    required: false,
  })
  @IsString()
  @IsOptional()
  realFolderId?: string;

  @ApiProperty({
    description: '文件夹图标',
    example: 'folder-open',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(50, { message: '图标名称不能超过50个字符' })
  icon?: string;

  @ApiProperty({
    description: '文件夹描述',
    example: '存放工作文档',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;
}

/**
 * 更新文件夹 DTO
 */
export class UpdateFolderDto {
  @ApiProperty({
    description: '文件夹名称',
    example: '新的文件夹名',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(100, { message: '文件夹名称不能超过100个字符' })
  name?: string;

  @ApiProperty({
    description: '映射的真实文件夹ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
    required: false,
  })
  @IsString()
  @IsOptional()
  realFolderId?: string;

  @ApiProperty({
    description: '文件夹图标',
    example: 'folder-open',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(50, { message: '图标名称不能超过50个字符' })
  icon?: string;

  @ApiProperty({
    description: '文件夹描述',
    example: '新的描述',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;
}

/**
 * 移动文件夹 DTO
 */
export class MoveFolderDto {
  @ApiProperty({
    description: '目标父文件夹ID（为空表示移动到根目录）',
    example: '550e8400-e29b-41d4-a716-446655440000',
    required: false,
  })
  @IsString()
  @IsOptional()
  parentId?: string;
}
