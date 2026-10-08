import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsString } from 'class-validator';

export class ParseCodesDto {
  @ApiProperty({ description: '预览阶段返回的 fileId' })
  @IsString()
  fileId: string;

  @ApiProperty({ description: 'Sheet 名称' })
  @IsString()
  sheet: string;

  @ApiProperty({ description: '编号列索引（0 开始）' })
  @IsInt()
  columnIndex: number;

  @ApiProperty({ description: '首行是否为表头' })
  @IsBoolean()
  hasHeader: boolean;
}
