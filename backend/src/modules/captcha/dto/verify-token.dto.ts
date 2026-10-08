import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class VerifyTokenDto {
    @ApiProperty({ description: '验证成功后获得的Token' })
    @IsString()
    token: string;
}
