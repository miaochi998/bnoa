import {
    IsOptional, IsString, IsInt, Min,
    IsBoolean, IsDateString, IsEnum,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryNotificationDto {
    @ApiPropertyOptional({ description: '页码', default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({ description: '每页数量', default: 20 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    pageSize?: number = 20;

    @ApiPropertyOptional({ description: '通知类型' })
    @IsOptional()
    @IsString()
    type?: string;

    @ApiPropertyOptional({
        description: '优先级',
        enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'],
    })
    @IsOptional()
    @IsString()
    priority?: string;

    @ApiPropertyOptional({ description: '是否已读' })
    @IsOptional()
    @Transform(({ value }) => value === 'true')
    @IsBoolean()
    isRead?: boolean;

    @ApiPropertyOptional({ description: '开始日期' })
    @IsOptional()
    @IsDateString()
    startDate?: string;

    @ApiPropertyOptional({ description: '结束日期' })
    @IsOptional()
    @IsDateString()
    endDate?: string;
}

export class QueryAdminNotificationDto
    extends QueryNotificationDto {
    @ApiPropertyOptional({ description: '用户ID' })
    @IsOptional()
    @IsString()
    userId?: string;
}

export class QueryBroadcastDto {
    @ApiPropertyOptional({ description: '页码', default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({ description: '每页数量', default: 20 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    pageSize?: number = 20;

    @ApiPropertyOptional({ description: '通知类型' })
    @IsOptional()
    @IsString()
    type?: string;

    @ApiPropertyOptional({
        description: '状态',
        enum: ['PENDING', 'SENDING', 'SENT', 'CANCELLED'],
    })
    @IsOptional()
    @IsString()
    status?: string;
}
