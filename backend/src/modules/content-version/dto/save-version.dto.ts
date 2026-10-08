import {
    IsNotEmpty,
    IsOptional,
    IsIn,
    MaxLength,
    IsObject,
} from 'class-validator';

export class SaveVersionDto {
    @IsNotEmpty({ message: 'content不能为空' })
    @IsObject({ message: 'content必须是对象' })
    content: any;

    @IsOptional()
    htmlContent?: string;

    @IsIn(
        ['manual', 'auto', 'restore'],
        { message: 'versionType无效' }
    )
    versionType: 'manual' | 'auto' | 'restore';

    @IsOptional()
    @MaxLength(100)
    versionName?: string;
}
