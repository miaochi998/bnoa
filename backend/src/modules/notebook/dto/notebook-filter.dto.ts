import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class NotebookFilterDto {
    @ApiProperty({ description: '关键词搜索（标题）', required: false })
    @IsString()
    @IsOptional()
    keyword?: string;

    @ApiProperty({ description: '用户ID（仅超管可用）', required: false })
    @IsString()
    @IsOptional()
    userId?: string;

    @ApiProperty({ description: '页码', example: 1, required: false })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @IsOptional()
    page?: number = 1;

    @ApiProperty({ description: '每页数量', example: 10, required: false })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @IsOptional()
    pageSize?: number = 10;
}
