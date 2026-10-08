import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ description: '旧密码', example: 'oldPassword123' })
  @IsString()
  @IsNotEmpty({ message: '旧密码不能为空' })
  oldPassword: string;

  @ApiProperty({ description: '新密码', example: 'newPassword123!' })
  @IsString()
  @IsNotEmpty({ message: '新密码不能为空' })
  @MaxLength(50, { message: '密码最多50个字符' })
  newPassword: string;

  @ApiProperty({ description: '确认新密码', example: 'newPassword123!' })
  @IsString()
  @IsNotEmpty({ message: '确认密码不能为空' })
  confirmPassword: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: '邮箱', example: 'john@example.com' })
  @IsString()
  @IsNotEmpty({ message: '邮箱不能为空' })
  email: string;

  @ApiProperty({ description: '验证码', example: '123456' })
  @IsString()
  @IsNotEmpty({ message: '验证码不能为空' })
  verificationCode: string;

  @ApiProperty({ description: '新密码', example: 'newPassword123!' })
  @IsString()
  @IsNotEmpty({ message: '新密码不能为空' })
  newPassword: string;
}
