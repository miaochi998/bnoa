import {
    IsString,
    IsOptional,
    IsArray,
    IsUUID,
    ArrayMinSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTalentTransferDto {
    @ApiProperty({
        description: '达人ID列表',
        type: [String],
    })
    @IsArray()
    @IsUUID('4', { each: true })
    @ArrayMinSize(1)
    talentIds: string[];

    @ApiProperty({ description: '目标负责人ID' })
    @IsString()
    toUserId: string;

    @ApiPropertyOptional({ description: '转交备注' })
    @IsString()
    @IsOptional()
    remark?: string;
}
