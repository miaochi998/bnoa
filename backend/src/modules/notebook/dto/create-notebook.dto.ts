import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsObject, MaxLength } from 'class-validator';

export class CreateNotebookDto {
    @ApiProperty({ description: '标题', example: '我的记事本' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(200)
    title: string;

    @ApiProperty({ description: '内容（Tiptap JSON 格式）', example: {} })
    @IsObject()
    @IsNotEmpty()
    content: any;
}
