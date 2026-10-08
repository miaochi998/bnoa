import { InputType, Field } from '@nestjs/graphql';
import {
  IsEmail,
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
  IsArray,
  ArrayNotEmpty,
} from 'class-validator';

@InputType()
export class CreateUserInput {
  @Field()
  @IsString()
  @MinLength(3, { message: '用户名至少3个字符' })
  @MaxLength(50, { message: '用户名最多50个字符' })
  @Matches(/^[a-zA-Z0-9_]+$/, { message: '用户名只能包含字母、数字和下划线' })
  username: string;

  @Field()
  @IsEmail({}, { message: '邮箱格式不正确' })
  email: string;

  @Field()
  @IsString()
  @MinLength(1, { message: '密码不能为空' })
  @MaxLength(50, { message: '密码最多50个字符' })
  password: string;

  @Field()
  @IsString()
  @MinLength(2, { message: '姓名至少2个字符' })
  @MaxLength(50, { message: '姓名最多50个字符' })
  name: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  phone?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  avatar?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  roleIds?: string[];
}

@InputType()
export class CreateUserInputRest {
  @IsString()
  @MinLength(3, { message: '用户名至少3个字符' })
  @MaxLength(50, { message: '用户名最多50个字符' })
  @Matches(/^[a-zA-Z0-9_]+$/, { message: '用户名只能包含字母、数字和下划线' })
  username: string;

  @IsOptional()
  @IsEmail({}, { message: '邮箱格式不正确' })
  email?: string;

  @IsString()
  @MinLength(1, { message: '密码不能为空' })
  @MaxLength(50, { message: '密码最多50个字符' })
  password: string;

  @IsOptional()
  @IsString()
  @MinLength(2, { message: '姓名至少2个字符' })
  @MaxLength(50, { message: '姓名最多50个字符' })
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  phone?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsArray({ message: '角色不能为空' })
  @ArrayNotEmpty({ message: '请选择至少一个角色' })
  roleIds: string[];
}
