import {
    IsString,
    IsInt,
    Min,
    IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTalentContactLogDto {
    @ApiProperty({ description: '沟通内容' })
    @IsString()
    content: string;
}

export class TalentContactLogQueryDto {
    @ApiPropertyOptional({ description: '页码', default: 1 })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @IsOptional()
    page?: number;

    @ApiPropertyOptional({
        description: '每页条数',
        default: 20,
    })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @IsOptional()
    pageSize?: number;
}
