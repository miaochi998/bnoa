import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';
import { UpgradeConfigService } from './upgrade-config.service';
import axios from 'axios';
import * as semver from 'semver';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class VersionService {
  private readonly logger = new Logger(VersionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: UpgradeConfigService,
  ) {}

  async getCurrentVersion(): Promise<{
    version: string;
    releaseDate: Date | null;
    releaseNotes: string | null;
  }> {
    const current = await this.prisma.systemVersion.findFirst({
      where: { isCurrent: true },
    });

    if (current) {
      return {
        version: current.version,
        releaseDate: current.releaseDate,
        releaseNotes: current.releaseNotes,
      };
    }

    try {
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      return {
        version: packageJson.version || '1.0.0',
        releaseDate: null,
        releaseNotes: null,
      };
    } catch (error) {
      this.logger.warn('无法读取 package.json，使用默认版本');
      return { version: '1.0.0', releaseDate: null, releaseNotes: null };
    }
  }

  async checkForUpdate(): Promise<{
    currentVersion: string;
    latestVersion: string;
    hasUpdate: boolean;
    releaseNotes: string | null;
    releaseDate: Date | null;
  }> {
    const current = await this.getCurrentVersion();

    try {
      const latest = await this.getLatestRelease();
      const hasUpdate = semver.gt(latest.version, current.version);

      return {
        currentVersion: current.version,
        latestVersion: latest.version,
        hasUpdate,
        releaseNotes: latest.releaseNotes,
        releaseDate: latest.releaseDate,
      };
    } catch (error) {
      this.logger.error(`检查更新失败: ${error.message}`);
      return {
        currentVersion: current.version,
        latestVersion: current.version,
        hasUpdate: false,
        releaseNotes: null,
        releaseDate: null,
      };
    }
  }

  async getLatestRelease(): Promise<{
    version: string;
    releaseNotes: string;
    releaseDate: Date;
  }> {
    const config = await this.configService.getConfig();

    if (!config.githubOwner || !config.githubRepo) {
      throw new Error('GitHub 仓库配置不完整，请在升级设置中配置');
    }

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'BNOA-Upgrade-Service',
    };

    if (config.githubToken) {
      headers['Authorization'] = `Bearer ${config.githubToken}`;
    }

    try {
      const response = await axios.get(
        `https://api.github.com/repos/${config.githubOwner}/${config.githubRepo}/releases/latest`,
        { headers, timeout: 15000 },
      );

      const release = response.data;
      const version = release.tag_name.replace(/^v/, '');

      return {
        version,
        releaseNotes: release.body || '',
        releaseDate: new Date(release.published_at),
      };
    } catch (error) {
      if (error.response?.status === 404) {
        throw new Error('GitHub 仓库未找到或没有发布 Release。如果是私有仓库，请配置 GitHub Token');
      }
      if (error.response?.status === 401) {
        throw new Error('GitHub Token 无效或已过期');
      }
      throw new Error(`获取最新版本失败: ${error.message}`);
    }
  }

  async setCurrentVersion(version: string): Promise<void> {
    const config = await this.configService.getConfig();
    const imagePrefix = config.dockerImagePrefix || 'miaochi/bnoa';

    await this.prisma.systemVersion.updateMany({
      where: { isCurrent: true },
      data: { isCurrent: false },
    });

    const existing = await this.prisma.systemVersion.findUnique({
      where: { version },
    });

    if (existing) {
      await this.prisma.systemVersion.update({
        where: { version },
        data: { isCurrent: true },
      });
    } else {
      await this.prisma.systemVersion.create({
        data: {
          version,
          isCurrent: true,
          backendImage: `${imagePrefix}-backend:${version}`,
          frontendImage: `${imagePrefix}-frontend:${version}`,
        },
      });
    }

    this.logger.log(`当前版本已设置为: ${version}`);
  }

  async initializeCurrentVersion(): Promise<void> {
    const current = await this.prisma.systemVersion.findFirst({
      where: { isCurrent: true },
    });

    if (!current) {
      const packageVersion = (await this.getCurrentVersion()).version;
      await this.setCurrentVersion(packageVersion);
      this.logger.log(`初始化版本记录: ${packageVersion}`);
    }
  }
}
