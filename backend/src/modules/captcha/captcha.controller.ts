import {
    Controller,
    Get,
    Post,
    Body,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CaptchaService } from './captcha.service';
import { VerifyCaptchaDto } from './dto/verify-captcha.dto';
import { VerifyTokenDto } from './dto/verify-token.dto';

@ApiTags('验证码')
@Controller('captcha')
export class CaptchaController {
    constructor(
        private readonly captchaService: CaptchaService,
    ) {}

    @Get('generate')
    @ApiOperation({ summary: '生成验证码' })
    async generate() {
        const data =
            await this.captchaService.generateCaptcha();
        return {
            code: 200,
            message: '验证码生成成功',
            data,
        };
    }

    @Post('verify')
    @ApiOperation({ summary: '验证滑块' })
    async verify(@Body() dto: VerifyCaptchaDto) {
        const result =
            await this.captchaService.verifyCaptcha(
                dto.id,
                dto.x,
                dto.trail,
            );
        if (result.success) {
            return {
                code: 200,
                message: result.message,
                data: { token: result.token },
            };
        }
        return {
            code: 400,
            message: result.message,
            data: null,
        };
    }

    @Post('verify-token')
    @ApiOperation({ summary: '二次验证Token' })
    async verifyToken(@Body() dto: VerifyTokenDto) {
        const valid =
            await this.captchaService.verifyToken(
                dto.token,
            );
        return {
            code: valid ? 200 : 400,
            message: valid
                ? 'Token有效'
                : 'Token无效或已过期',
            data: { valid },
        };
    }

    @Get('config')
    @ApiOperation({ summary: '获取验证码公开配置' })
    async getConfig() {
        const config =
            await this.captchaService.getFullConfig();
        return {
            code: 200,
            message: '获取配置成功',
            data: config,
        };
    }
}
