import { InputType, Field } from '@nestjs/graphql';
import { IsOptional, IsString, IsEnum } from 'class-validator';

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

@InputType()
export class UserFilterInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  keyword?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  roleId?: string;
}

@InputType()
export class PageInput {
  @Field({ defaultValue: 1 })
  page: number;

  @Field({ defaultValue: 10 })
  pageSize: number;
}

export class UserFilterInputRest {
  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsString()
  roleId?: string;

  @IsOptional()
  @IsString()
  sortBy?: 'createdAt' | 'lastLoginAt';

  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';
}

export class PageInputRest {
  page: number = 1;
  pageSize: number = 10;
}
