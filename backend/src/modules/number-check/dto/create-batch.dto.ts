import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateBatchDto {
  @ApiProperty({ description: '待入库编号列表' })
  @IsArray()
  @IsString({ each: true })
  codes: string[];

  @ApiProperty({ description: '导入时间（可空，默认当前）', required: false })
  @IsOptional()
  @IsString()
  importedAt?: string;

  @ApiProperty({ description: '是否已结算', required: false })
  @IsOptional()
  @IsBoolean()
  isSettled?: boolean;

  @ApiProperty({ description: '备注', required: false })
  @IsOptional()
  @IsString()
  remark?: string;

  @ApiProperty({ description: '原始文件 id（来源于文件导入）', required: false })
  @IsOptional()
  @IsString()
  fileId?: string;

  @ApiProperty({
    description: '重复处理方式：skip 跳过 / save 一并保存 / onlyNew 只存未重复',
    enum: ['skip', 'save', 'onlyNew'],
    required: false,
  })
  @IsOptional()
  @IsIn(['skip', 'save', 'onlyNew'])
  onDuplicate?: 'skip' | 'save' | 'onlyNew';
}
