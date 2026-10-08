import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UploadSessionService } from './upload-session.service';
import {
  CheckFileExistsDto,
  InitUploadDto,
  GeneratePresignedUrlsDto,
  CompleteUploadDto,
  AbortUploadDto,
  FileExistsResponse,
  InitUploadResponse,
  PresignedUrlsResponse,
  CompleteUploadResponse,
  UploadSessionResponse,
} from './dto/upload.dto';

/**
 * 上传管理控制器
 */
@ApiTags('文件上传')
@Controller('upload')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UploadController {
  constructor(private readonly uploadSessionService: UploadSessionService) {}

  @Post('check')
  @ApiOperation({ summary: '秒传检查 - 检查文件是否已存在' })
  @ApiResponse({ status: 200, type: FileExistsResponse })
  async checkFileExists(
    @Body() dto: CheckFileExistsDto,
    @CurrentUser('userId') userId: string,
  ): Promise<FileExistsResponse> {
    return this.uploadSessionService.checkFileExists(dto, userId);
  }

  @Post('init')
  @ApiOperation({ summary: '初始化上传 - 创建上传会话' })
  @ApiResponse({ status: 201, type: InitUploadResponse })
  async initUpload(
    @Body() dto: InitUploadDto,
    @CurrentUser('userId') userId: string,
  ): Promise<InitUploadResponse> {
    return this.uploadSessionService.initUpload(dto, userId);
  }

  @Post('presigned-urls')
  @ApiOperation({ summary: '获取预签名URL - 用于分片上传' })
  @ApiResponse({ status: 200, type: PresignedUrlsResponse })
  async generatePresignedUrls(
    @Body() dto: GeneratePresignedUrlsDto,
    @CurrentUser('userId') userId: string,
  ): Promise<PresignedUrlsResponse> {
    return this.uploadSessionService.generatePresignedUrls(dto, userId);
  }

  @Post('complete')
  @ApiOperation({ summary: '完成上传 - 合并分片并创建文件记录' })
  @ApiResponse({ status: 200, type: CompleteUploadResponse })
  async completeUpload(
    @Body() dto: CompleteUploadDto,
    @CurrentUser('userId') userId: string,
  ): Promise<CompleteUploadResponse> {
    return this.uploadSessionService.completeUpload(dto, userId);
  }

  @Post('abort')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '取消上传 - 取消上传会话' })
  @ApiResponse({ status: 204 })
  async abortUpload(
    @Body() dto: AbortUploadDto,
    @CurrentUser('userId') userId: string,
  ): Promise<void> {
    return this.uploadSessionService.abortUpload(dto.sessionId, userId);
  }

  @Get('session/:id')
  @ApiOperation({ summary: '获取上传会话状态' })
  @ApiResponse({ status: 200, type: UploadSessionResponse })
  async getSessionStatus(
    @Param('id') sessionId: string,
    @CurrentUser('userId') userId: string,
  ): Promise<UploadSessionResponse> {
    return this.uploadSessionService.getSessionStatus(sessionId, userId);
  }
}
