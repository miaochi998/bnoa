import {
    IsOptional,
    IsIn,
    Min,
    Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class QueryVersionsDto {
    @IsOptional()
    @Type(() => Number)
    @Min(1)
    page?: number = 1;

    @IsOptional()
    @Type(() => Number)
    @Min(1)
    @Max(100)
    pageSize?: number = 20;

    @IsOptional()
    @IsIn(['all', 'manual', 'auto'])
    type?: 'all' | 'manual' | 'auto' = 'all';
}
