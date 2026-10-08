import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject, MaxLength } from 'class-validator';

export class UpdateNotebookDto {
    @ApiProperty({ description: '标题', example: '我的记事本', required: false })
    @IsString()
    @IsOptional()
    @MaxLength(200)
    title?: string;

    @ApiProperty({ description: '内容（Tiptap JSON 格式）', example: {}, required: false })
    @IsObject()
    @IsOptional()
    content?: any;
}
