import {
    IsString,
    IsNotEmpty,
    IsArray,
    ValidateNested,
    IsOptional,
    IsNumber,
    IsIn,
    Min,
    Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class MessageDto {
    @ApiProperty({ description: '消息角色', enum: ['system', 'user', 'assistant'] })
    @IsString()
    @IsNotEmpty()
    @IsIn(['system', 'user', 'assistant'])
    role: string;

    @ApiProperty({ description: '消息内容' })
    @IsString()
    @IsNotEmpty()
    content: string;
}

class GenerateOptionsDto {
    @ApiPropertyOptional({ description: '温度参数', minimum: 0, maximum: 2 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(2)
    temperature?: number;

    @ApiPropertyOptional({ description: '最大token数' })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(100000)
    maxTokens?: number;

    @ApiPropertyOptional({ description: 'Top P采样', minimum: 0, maximum: 1 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(1)
    topP?: number;
}

export class GenerateContentDto {
    @ApiProperty({ description: '模型名称' })
    @IsString()
    @IsNotEmpty()
    modelName: string;

    @ApiProperty({ description: '消息列表', type: [MessageDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => MessageDto)
    messages: MessageDto[];

    @ApiPropertyOptional({ description: '生成选项' })
    @IsOptional()
    @ValidateNested()
    @Type(() => GenerateOptionsDto)
    options?: GenerateOptionsDto;
}
