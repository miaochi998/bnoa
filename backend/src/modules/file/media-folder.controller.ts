import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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
import { PermissionGuard } from '../../common/guards/permission.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { RealFolderService } from './real-folder.service';
import {
  CreateRealFolderDto,
  UpdateRealFolderDto,
  RealFolderResponse,
} from './dto/folder.dto';

/**
 * 真实文件夹管理控制器
 */
@ApiTags('真实文件夹管理')
@Controller('folders/real')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class RealFolderController {
  constructor(private readonly realFolderService: RealFolderService) {}

  @Post()
  @Permissions('folder:manage')
  @ApiOperation({ summary: '创建真实文件夹' })
  @ApiResponse({ status: 201, type: RealFolderResponse })
  async create(@Body() dto: CreateRealFolderDto): Promise<RealFolderResponse> {
    return this.realFolderService.create(dto);
  }

  @Get()
  @Permissions('file-storage:manage')
  @ApiOperation({ summary: '获取所有真实文件夹' })
  @ApiResponse({ status: 200, type: [RealFolderResponse] })
  async findAll(): Promise<RealFolderResponse[]> {
    return this.realFolderService.findAll();
  }

  @Get(':id')
  @Permissions('file-storage:manage')
  @ApiOperation({ summary: '获取真实文件夹详情' })
  @ApiResponse({ status: 200, type: RealFolderResponse })
  async findById(@Param('id') id: string): Promise<RealFolderResponse> {
    return this.realFolderService.findById(id);
  }

  @Patch(':id')
  @Permissions('folder:manage')
  @ApiOperation({ summary: '更新真实文件夹' })
  @ApiResponse({ status: 200, type: RealFolderResponse })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateRealFolderDto,
  ): Promise<RealFolderResponse> {
    return this.realFolderService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('folder:manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除真实文件夹' })
  @ApiResponse({ status: 204 })
  async delete(@Param('id') id: string): Promise<void> {
    return this.realFolderService.delete(id);
  }

  @Post('init-system')
  @Permissions('folder:manage')
  @ApiOperation({ summary: '初始化系统默认文件夹' })
  @ApiResponse({ status: 200 })
  async initSystemFolders(): Promise<{ message: string }> {
    await this.realFolderService.initSystemFolders();
    return { message: '系统文件夹初始化完成' };
  }
}
