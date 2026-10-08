import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class ExportDuplicatesDto {
  @ApiProperty({ description: '编号列表' })
  @IsArray()
  @IsString({ each: true })
  codes: string[];
}
