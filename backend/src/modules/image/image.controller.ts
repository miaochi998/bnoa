import {
  Controller,
  Post,
  Get,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ImageService } from './image.service';
import {
  ProcessImageDto,
  GenerateThumbnailDto,
  CompressImageDto,
  ImageFormat,
} from './dto/process-image.dto';

/**
 * 图片处理控制器
 * 提供图片处理、压缩、格式转换等接口
 */
@ApiTags('image')
@Controller('image')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ImageController {
  constructor(private readonly imageService: ImageService) {}

  /**
   * 获取图片信息
   */
  @Post('info')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '获取图片信息',
    description: '上传图片并获取其元数据信息',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 400, description: '无效的图片文件' })
  async getImageInfo(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('请选择要上传的图片');
    }

    if (!this.imageService.isSupportedImageType(file.mimetype)) {
      throw new BadRequestException(`不支持的图片格式: ${file.mimetype}`);
    }

    const info = await this.imageService.getImageInfo(file.buffer);

    return {
      success: true,
      message: '获取图片信息成功',
      data: info,
    };
  }

  /**
   * 处理图片
   */
  @Post('process')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '处理图片',
    description: '调整图片尺寸、格式、质量等',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @ApiResponse({ status: 200, description: '处理成功' })
  @ApiResponse({ status: 400, description: '处理失败' })
  async processImage(
    @UploadedFile() file: Express.Multer.File,
    @Body() options: ProcessImageDto,
    @Res() res: Response,
  ) {
    if (!file) {
      throw new BadRequestException('请选择要上传的图片');
    }

    if (!this.imageService.isSupportedImageType(file.mimetype)) {
      throw new BadRequestException(`不支持的图片格式: ${file.mimetype}`);
    }

    const result = await this.imageService.processImage(file.buffer, options);

    // 设置响应头
    const mimeType = this.getMimeType(result.format);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', result.size);
    res.send(result.buffer);
  }

  /**
   * 生成缩略图
   */
  @Post('thumbnail')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '生成缩略图', description: '生成指定尺寸的缩略图' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @ApiResponse({ status: 200, description: '生成成功' })
  @ApiResponse({ status: 400, description: '生成失败' })
  async generateThumbnail(
    @UploadedFile() file: Express.Multer.File,
    @Body() options: GenerateThumbnailDto,
    @Res() res: Response,
  ) {
    if (!file) {
      throw new BadRequestException('请选择要上传的图片');
    }

    if (!this.imageService.isSupportedImageType(file.mimetype)) {
      throw new BadRequestException(`不支持的图片格式: ${file.mimetype}`);
    }

    const result = await this.imageService.generateThumbnail(
      file.buffer,
      options,
    );

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Length', result.size);
    res.send(result.buffer);
  }

  /**
   * 压缩图片
   */
  @Post('compress')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '压缩图片',
    description: '压缩图片大小，可选择调整尺寸',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @ApiResponse({ status: 200, description: '压缩成功' })
  @ApiResponse({ status: 400, description: '压缩失败' })
  async compressImage(
    @UploadedFile() file: Express.Multer.File,
    @Body() options: CompressImageDto,
    @Res() res: Response,
  ) {
    if (!file) {
      throw new BadRequestException('请选择要上传的图片');
    }

    if (!this.imageService.isSupportedImageType(file.mimetype)) {
      throw new BadRequestException(`不支持的图片格式: ${file.mimetype}`);
    }

    const result = await this.imageService.compressImage(file.buffer, options);

    const mimeType = this.getMimeType(result.format);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', result.size);
    res.send(result.buffer);
  }

  /**
   * 转换图片格式
   */
  @Post('convert')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '转换图片格式',
    description: '将图片转换为指定格式',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @ApiResponse({ status: 200, description: '转换成功' })
  @ApiResponse({ status: 400, description: '转换失败' })
  async convertFormat(
    @UploadedFile() file: Express.Multer.File,
    @Query('format') format: ImageFormat,
    @Query('quality') quality: number = 80,
    @Res() res: Response,
  ) {
    if (!file) {
      throw new BadRequestException('请选择要上传的图片');
    }

    if (!this.imageService.isSupportedImageType(file.mimetype)) {
      throw new BadRequestException(`不支持的图片格式: ${file.mimetype}`);
    }

    if (!format) {
      throw new BadRequestException('请指定目标格式');
    }

    const result = await this.imageService.convertFormat(
      file.buffer,
      format,
      quality,
    );

    const mimeType = this.getMimeType(result.format);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', result.size);
    res.send(result.buffer);
  }

  /**
   * 获取支持的图片格式
   */
  @Get('supported-formats')
  @ApiOperation({ summary: '获取支持的图片格式' })
  @ApiResponse({ status: 200, description: '获取成功' })
  getSupportedFormats() {
    return {
      success: true,
      message: '获取成功',
      data: {
        formats: ['jpeg', 'png', 'webp', 'avif', 'gif'],
        mimeTypes: [
          'image/jpeg',
          'image/png',
          'image/webp',
          'image/gif',
          'image/avif',
          'image/tiff',
          'image/svg+xml',
        ],
      },
    };
  }

  /**
   * 根据格式获取 MIME 类型
   */
  private getMimeType(format: ImageFormat): string {
    switch (format) {
      case ImageFormat.JPEG:
        return 'image/jpeg';
      case ImageFormat.PNG:
        return 'image/png';
      case ImageFormat.WEBP:
        return 'image/webp';
      case ImageFormat.AVIF:
        return 'image/avif';
      case ImageFormat.GIF:
        return 'image/gif';
      default:
        return 'image/jpeg';
    }
  }
}
