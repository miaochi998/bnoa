import {
    IsEnum,
    IsString,
    IsArray,
    ValidateNested,
    MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { TalentFlagColor } from '@prisma/client';

export class SetTalentFlagDto {
    @ApiProperty({
        description: '标旗颜色',
        enum: TalentFlagColor,
    })
    @IsEnum(TalentFlagColor)
    flagColor: TalentFlagColor;
}

class FlagConfigItem {
    @ApiProperty({
        description: '标旗颜色',
        enum: TalentFlagColor,
    })
    @IsEnum(TalentFlagColor)
    flagColor: TalentFlagColor;

    @ApiProperty({ description: '含义' })
    @IsString()
    @MaxLength(100)
    meaning: string;
}

export class SaveFlagConfigsDto {
    @ApiProperty({
        description: '标旗含义配置列表',
        type: [FlagConfigItem],
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => FlagConfigItem)
    configs: FlagConfigItem[];
}
