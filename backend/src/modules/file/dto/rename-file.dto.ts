import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 重命名文件 DTO
 */
export class RenameFileDto {
  @ApiProperty({
    description: '新文件名',
    example: 'new-document.pdf',
  })
  @IsString()
  @IsNotEmpty({ message: '文件名不能为空' })
  name: string;
}

/**
 * 移动文件 DTO
 */
export class MoveFileDto {
  @ApiProperty({
    description: '目标文件夹ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsNotEmpty({ message: '目标文件夹ID不能为空' })
  folderId: string;
}

/**
 * 批量移动文件 DTO
 */
export class BatchMoveFilesDto {
  @ApiProperty({
    description: '文件ID列表',
    example: ['550e8400-e29b-41d4-a716-446655440000'],
    type: [String],
  })
  @IsString({ each: true })
  fileIds: string[];

  @ApiProperty({
    description: '目标文件夹ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsNotEmpty({ message: '目标文件夹ID不能为空' })
  folderId: string;
}

/**
 * 批量删除文件 DTO
 */
export class BatchDeleteFilesDto {
  @ApiProperty({
    description: '文件ID列表',
    example: ['550e8400-e29b-41d4-a716-446655440000'],
    type: [String],
  })
  @IsString({ each: true })
  fileIds: string[];
}
