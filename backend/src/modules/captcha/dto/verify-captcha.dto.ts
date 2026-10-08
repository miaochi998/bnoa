import { ApiProperty } from '@nestjs/swagger';
import {
    IsString,
    IsNumber,
    IsOptional,
    IsArray,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TrailDto {
    @ApiProperty({ description: 'x坐标序列', type: [Number] })
    @IsArray()
    @IsNumber({}, { each: true })
    x: number[];

    @ApiProperty({ description: 'y坐标序列', type: [Number] })
    @IsArray()
    @IsNumber({}, { each: true })
    y: number[];
}

export class VerifyCaptchaDto {
    @ApiProperty({ description: '验证码ID' })
    @IsString()
    id: string;

    @ApiProperty({ description: '用户拖动的x坐标' })
    @IsNumber()
    x: number;

    @ApiProperty({ description: '滑动轨迹', required: false })
    @IsOptional()
    @ValidateNested()
    @Type(() => TrailDto)
    trail?: TrailDto;
}
