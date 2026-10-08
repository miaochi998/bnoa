import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Req,
  Res,
  UseGuards,
  Ip,
  Headers,
  UseInterceptors,
  UploadedFile,
  StreamableFile,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, LoginResponseDto } from './dto/login.dto';
import {
  RefreshTokenDto,
  RefreshTokenResponseDto,
} from './dto/refresh-token.dto';
import { RegisterDto, RegisterResponseDto } from './dto/register.dto';
import { ChangePasswordDto, ResetPasswordDto } from './dto/change-password.dto';
import { SendResetCodeDto } from '../email/dto/email.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('认证授权')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '用户登录',
    description: '支持用户名、邮箱、手机号登录',
  })
  @ApiResponse({
    status: 200,
    description: '登录成功',
    type: LoginResponseDto,
  })
  @ApiResponse({ status: 401, description: '用户名或密码错误' })
  @ApiResponse({ status: 403, description: '账户被禁用或锁定' })
  async login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @Req() req: Request,
  ): Promise<LoginResponseDto> {
    const userAgent = req.headers['user-agent'] || '';
    return this.authService.login(dto, ip, userAgent);
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '用户注册' })
  @ApiResponse({
    status: 201,
    description: '注册成功',
    type: RegisterResponseDto,
  })
  @ApiResponse({ status: 409, description: '用户名或邮箱已存在' })
  async register(@Body() dto: RegisterDto): Promise<RegisterResponseDto> {
    return this.authService.register(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '刷新令牌',
    description: '使用刷新令牌获取新的访问令牌',
  })
  @ApiResponse({
    status: 200,
    description: '刷新成功',
    type: RefreshTokenResponseDto,
  })
  @ApiResponse({ status: 401, description: '无效的刷新令牌' })
  async refreshToken(
    @Body() dto: RefreshTokenDto,
  ): Promise<RefreshTokenResponseDto> {
    return this.authService.refreshToken(dto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '用户登出' })
  @ApiResponse({ status: 200, description: '登出成功' })
  async logout(
    @CurrentUser('sub') userId: string,
    @Body('refreshToken') refreshToken?: string,
  ): Promise<{ message: string }> {
    await this.authService.logout(userId, refreshToken);
    return { message: '登出成功' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取当前用户信息' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 401, description: '未授权' })
  async getCurrentUser(@CurrentUser('sub') userId: string) {
    return this.authService.getCurrentUser(userId);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新个人资料' })
  @ApiResponse({ status: 200, description: '更新成功' })
  async updateProfile(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(userId, dto);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '修改密码' })
  @ApiResponse({ status: 200, description: '修改成功' })
  @ApiResponse({ status: 400, description: '旧密码错误或两次密码不一致' })
  async changePassword(
    @CurrentUser('sub') userId: string,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.changePassword(userId, dto);
    return { message: '密码修改成功，请使用新密码重新登录' };
  }

  @Post('send-reset-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '发送密码重置验证码',
    description: '发送密码重置验证码到邮箱（无需登录）',
  })
  @ApiResponse({ status: 200, description: '发送成功' })
  async sendResetCode(
    @Body() dto: SendResetCodeDto,
  ): Promise<{ message: string }> {
    await this.authService.sendResetCode(dto.email);
    return { message: '如果该邮箱已注册，验证码已发送' };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '重置密码', description: '通过邮箱验证码重置密码' })
  @ApiResponse({ status: 200, description: '重置成功' })
  @ApiResponse({ status: 400, description: '用户不存在或验证码错误' })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.resetPassword(dto);
    return { message: '密码重置成功，请使用新密码登录' };
  }

  @Post('avatar')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '上传头像' })
  @ApiResponse({ status: 200, description: '上传成功' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(
    @CurrentUser('sub') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new Error('请选择头像文件');
    }
    return this.authService.uploadAvatar(userId, file);
  }

  @Delete('avatar')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除头像' })
  @ApiResponse({ status: 200, description: '删除成功' })
  async deleteAvatar(
    @CurrentUser('sub') userId: string,
  ): Promise<{ message: string }> {
    await this.authService.deleteAvatar(userId);
    return { message: '头像删除成功' };
  }

  @Post('default-avatar')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '上传默认头像（管理员）' })
  @ApiResponse({ status: 200, description: '上传成功' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadDefaultAvatar(
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new Error('请选择默认头像文件');
    }
    return this.authService.uploadDefaultAvatar(file);
  }

  @Get('avatar/:userId')
  @ApiOperation({ summary: '获取用户头像（公开代理）' })
  @ApiResponse({ status: 200, description: '返回头像图片' })
  @ApiResponse({ status: 404, description: '头像不存在' })
  async getAvatar(
    @Param('userId') userId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const result = await this.authService.getAvatarBuffer(userId);
    if (!result) {
      throw new NotFoundException('头像不存在');
    }
    res.set({
      'Content-Type': result.mimeType,
      'Content-Length': result.buffer.length.toString(),
      'Cache-Control': 'public, max-age=86400',
    });
    return new StreamableFile(result.buffer);
  }

  @Get('default-avatar')
  @ApiOperation({ summary: '获取默认头像（公开代理）' })
  @ApiResponse({ status: 200, description: '返回默认头像图片' })
  @ApiResponse({ status: 404, description: '默认头像不存在' })
  async getDefaultAvatar(
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const result =
      await this.authService.getDefaultAvatarBuffer();
    if (!result) {
      throw new NotFoundException('默认头像不存在');
    }
    res.set({
      'Content-Type': result.mimeType,
      'Content-Length': result.buffer.length.toString(),
      'Cache-Control': 'public, max-age=86400',
    });
    return new StreamableFile(result.buffer);
  }
}
