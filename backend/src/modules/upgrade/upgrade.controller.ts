import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UpgradeService } from './upgrade.service';
import { VersionService } from './services/version.service';
import { UpgradeConfigService } from './services/upgrade-config.service';
import { PortainerService } from './services/portainer.service';
import { HealthCheckService } from './services/health-check.service';
import { UpgradeConfigDto, ExecuteUpgradeDto } from './dto/upgrade.dto';
import { Request } from 'express';

@ApiTags('系统升级')
@Controller('upgrade')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UpgradeController {
  constructor(
    private readonly upgradeService: UpgradeService,
    private readonly versionService: VersionService,
    private readonly configService: UpgradeConfigService,
    private readonly portainerService: PortainerService,
    private readonly healthCheckService: HealthCheckService,
  ) {}

  @Get('version')
  @ApiOperation({ summary: '获取当前版本信息' })
  async getCurrentVersion() {
    return this.versionService.getCurrentVersion();
  }

  @Get('check')
  @ApiOperation({ summary: '检查更新' })
  async checkForUpdate() {
    // 走 UpgradeService：发现新版本时会**异步**触发后台预拉取镜像（不阻塞本次响应）
    return this.upgradeService.checkForUpdate();
  }

  @Post('execute')
  @ApiOperation({ summary: '执行升级' })
  async executeUpgrade(
    @Body() dto: ExecuteUpgradeDto,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      req.socket.remoteAddress ||
      '';
    return this.upgradeService.executeUpgrade(
      dto.targetVersion,
      user.userId,
      ip,
    );
  }

  @Get('progress')
  @ApiOperation({ summary: '获取升级进度' })
  async getUpgradeProgress(@Query('upgradeId') upgradeId?: string) {
    return this.upgradeService.getUpgradeProgress(upgradeId);
  }

  @Get('logs')
  @ApiOperation({ summary: '获取升级日志列表' })
  async getUpgradeLogs(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.upgradeService.getUpgradeLogs(
      parseInt(page || '1', 10),
      parseInt(pageSize || '20', 10),
    );
  }

  @Get('config')
  @ApiOperation({ summary: '获取升级配置' })
  async getConfig() {
    const config = await this.configService.getConfig();
    return {
      ...config,
      githubToken: config.githubToken ? '••••••••' : '',
      portainerApiKey: config.portainerApiKey ? '••••••••' : '',
    };
  }

  @Put('config')
  @ApiOperation({ summary: '保存升级配置' })
  async saveConfig(@Body() dto: UpgradeConfigDto) {
    const currentConfig = await this.configService.getConfig();

    const newConfig = {
      ...currentConfig,
      ...dto,
      githubToken:
        dto.githubToken === '••••••••'
          ? currentConfig.githubToken
          : dto.githubToken || currentConfig.githubToken,
      portainerApiKey:
        dto.portainerApiKey === '••••••••'
          ? currentConfig.portainerApiKey
          : dto.portainerApiKey || currentConfig.portainerApiKey,
    };

    await this.configService.saveConfig(newConfig);
    this.portainerService.resetClient();

    return {
      ...newConfig,
      githubToken: newConfig.githubToken ? '••••••••' : '',
      portainerApiKey: newConfig.portainerApiKey ? '••••••••' : '',
    };
  }

  @Get('config/status')
  @ApiOperation({ summary: '获取配置状态' })
  async getConfigStatus() {
    return this.configService.getConfigStatus();
  }

  @Post('portainer/test')
  @ApiOperation({ summary: '测试 Portainer 连接' })
  async testPortainerConnection() {
    return this.portainerService.testConnection();
  }

  @Get('health/services')
  @ApiOperation({ summary: '获取所有服务健康状态' })
  async getServicesHealth() {
    return this.healthCheckService.checkAllServices();
  }
}
