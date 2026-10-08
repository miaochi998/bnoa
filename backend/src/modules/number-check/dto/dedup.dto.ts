import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class DedupDto {
  @ApiProperty({
    description: '编号列表',
    example: ['654987231365498', 'k5s5643df2123yAD'],
  })
  @IsArray()
  @IsString({ each: true })
  codes: string[];
}
