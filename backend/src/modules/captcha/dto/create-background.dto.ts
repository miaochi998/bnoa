import { ApiProperty } from '@nestjs/swagger';
import {
    IsString,
    IsInt,
    IsOptional,
    IsArray,
    IsBoolean,
} from 'class-validator';

export class CreateBackgroundDto {
    @ApiProperty({ description: '原始文件名' })
    @IsString()
    fileName: string;

    @ApiProperty({ description: 'RUSTFS存储路径或URL' })
    @IsString()
    filePath: string;

    @ApiProperty({ description: '文件大小(字节)' })
    @IsInt()
    fileSize: number;

    @ApiProperty({ description: 'MIME类型' })
    @IsString()
    mimeType: string;

    @ApiProperty({ description: '图片宽度', required: false })
    @IsOptional()
    @IsInt()
    width?: number;

    @ApiProperty({ description: '图片高度', required: false })
    @IsOptional()
    @IsInt()
    height?: number;

    @ApiProperty({ description: '存储类型' })
    @IsString()
    storageType: string;

    @ApiProperty({ description: '虚拟文件夹ID', required: false })
    @IsOptional()
    @IsString()
    folderId?: string;
}

export class UpdateBackgroundDto {
    @ApiProperty({ description: '是否启用', required: false })
    @IsOptional()
    @IsBoolean()
    isEnabled?: boolean;

    @ApiProperty({ description: '排序', required: false })
    @IsOptional()
    @IsInt()
    sortOrder?: number;
}

export class BatchDeleteDto {
    @ApiProperty({ description: '背景图ID列表' })
    @IsArray()
    @IsString({ each: true })
    ids: string[];
}

export class BatchCreateBackgroundDto {
    @ApiProperty({ description: '背景图列表', type: [CreateBackgroundDto] })
    @IsArray()
    items: CreateBackgroundDto[];
}
