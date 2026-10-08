import {
    IsString, IsOptional, IsArray, IsEnum,
    MaxLength, IsUrl, ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBroadcastDto {
    @ApiProperty({ description: '通知类型' })
    @IsString()
    type: string;

    @ApiProperty({
        description: '优先级',
        enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'],
    })
    @IsEnum(['LOW', 'NORMAL', 'HIGH', 'URGENT'])
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

    @ApiProperty({ description: '标题', maxLength: 200 })
    @IsString()
    @MaxLength(200)
    title: string;

    @ApiPropertyOptional({ description: '内容' })
    @IsOptional()
    @IsString()
    content?: string;

    @ApiPropertyOptional({ description: '跳转链接' })
    @IsOptional()
    @IsString()
    actionUrl?: string;

    @ApiProperty({
        description: '目标类型',
        enum: ['all', 'role', 'users'],
    })
    @IsEnum(['all', 'role', 'users'])
    targetType: 'all' | 'role' | 'users';

    @ApiPropertyOptional({
        description: '目标角色ID列表',
        type: [String],
    })
    @ValidateIf((o) => o.targetType === 'role')
    @IsArray()
    @IsString({ each: true })
    targetRoles?: string[];

    @ApiPropertyOptional({
        description: '目标用户ID列表',
        type: [String],
    })
    @ValidateIf((o) => o.targetType === 'users')
    @IsArray()
    @IsString({ each: true })
    targetUserIds?: string[];
}
