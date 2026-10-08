import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateRecordDto {
  @ApiProperty({ description: '备注', required: false })
  @IsOptional()
  @IsString()
  remark?: string;

  @ApiProperty({ description: '是否已结算', required: false })
  @IsOptional()
  @IsBoolean()
  isSettled?: boolean;

  @ApiProperty({
    description: '状态：ACTIVE 正常 / VOID 已作废',
    enum: ['ACTIVE', 'VOID'],
    required: false,
  })
  @IsOptional()
  @IsIn(['ACTIVE', 'VOID'])
  status?: 'ACTIVE' | 'VOID';
}
