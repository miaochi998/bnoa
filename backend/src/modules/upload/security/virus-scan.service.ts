/**
 * 病毒扫描服务
 * F033: 使用ClamAV进行病毒扫描
 */

import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promisify } from 'util';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

/**
 * 扫描结果
 */
export interface ScanResult {
  /** 是否安全 */
  safe: boolean;
  /** 是否检测到病毒 */
  infected: boolean;
  /** 检测到的病毒名称 */
  virusName?: string;
  /** 扫描详情 */
  details: string;
  /** 扫描耗时（毫秒） */
  scanTime: number;
  /** 扫描引擎 */
  engine: string;
  /** 病毒库版本 */
  databaseVersion?: string;
}

/**
 * ClamAV配置
 */
export interface ClamAVConfig {
  /** 是否启用病毒扫描 */
  enabled: boolean;
  /** ClamAV socket路径 */
  socketPath: string;
  /** ClamAV主机（TCP模式） */
  host: string;
  /** ClamAV端口（TCP模式） */
  port: number;
  /** 使用socket还是TCP */
  useSocket: boolean;
  /** 扫描超时（毫秒） */
  timeout: number;
  /** 最大扫描文件大小（字节） */
  maxScanSize: number;
}

@Injectable()
export class VirusScanService {
  private readonly logger = new Logger(VirusScanService.name);
  private readonly config: ClamAVConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = {
      enabled: this.configService.get<boolean>('CLAMAV_ENABLED', true),
      socketPath: this.configService.get<string>(
        'CLAMAV_SOCKET',
        '/var/run/clamav/clamd.ctl',
      ),
      host: this.configService.get<string>('CLAMAV_HOST', '127.0.0.1'),
      port: this.configService.get<number>('CLAMAV_PORT', 3310),
      useSocket: this.configService.get<boolean>('CLAMAV_USE_SOCKET', false),
      timeout: this.configService.get<number>('CLAMAV_TIMEOUT', 30000),
      maxScanSize: this.configService.get<number>(
        'CLAMAV_MAX_SCAN_SIZE',
        104857600, // 100MB
      ),
    };

    if (this.config.enabled) {
      this.checkClamAVAvailability();
    }
  }

  /**
   * 检查ClamAV是否可用
   */
  private async checkClamAVAvailability(): Promise<void> {
    try {
      const version = await this.getClamAVVersion();
      this.logger.log(`ClamAV已连接: ${version}`);
    } catch (error) {
      this.logger.warn(`ClamAV不可用: ${error}，病毒扫描功能将被禁用`);
      this.config.enabled = false;
    }
  }

  /**
   * 获取ClamAV版本
   */
  async getClamAVVersion(): Promise<string> {
    try {
      const { stdout } = await execAsync('clamdscan --version', {
        timeout: 5000,
      });
      return stdout.trim();
    } catch {
      // 尝试使用clamscan
      try {
        const { stdout } = await execAsync('clamscan --version', {
          timeout: 5000,
        });
        return stdout.trim();
      } catch (error) {
        throw new Error('ClamAV未安装或不可用');
      }
    }
  }

  /**
   * 获取病毒库信息
   */
  async getDatabaseInfo(): Promise<{ version: string; lastUpdate: Date | null }> {
    try {
      const { stdout } = await execAsync('sigtool --info /var/lib/clamav/daily.cvd 2>/dev/null || sigtool --info /var/lib/clamav/daily.cld 2>/dev/null', {
        timeout: 5000,
      });
      
      const versionMatch = stdout.match(/Version:\s*(\d+)/);
      const dateMatch = stdout.match(/Build time:\s*(.+)/);
      
      return {
        version: versionMatch ? versionMatch[1] : 'unknown',
        lastUpdate: dateMatch ? new Date(dateMatch[1]) : null,
      };
    } catch {
      return { version: 'unknown', lastUpdate: null };
    }
  }

  /**
   * 扫描文件
   * @param filePath 文件路径
   */
  async scanFile(filePath: string): Promise<ScanResult> {
    const startTime = Date.now();

    // 检查是否启用
    if (!this.config.enabled) {
      return {
        safe: true,
        infected: false,
        details: '病毒扫描已禁用',
        scanTime: 0,
        engine: 'disabled',
      };
    }

    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      throw new BadRequestException('文件不存在');
    }

    // 检查文件大小
    const stats = fs.statSync(filePath);
    if (stats.size > this.config.maxScanSize) {
      this.logger.warn(`文件过大，跳过扫描: ${filePath} (${stats.size} bytes)`);
      return {
        safe: true,
        infected: false,
        details: '文件过大，跳过扫描',
        scanTime: Date.now() - startTime,
        engine: 'skipped',
      };
    }

    try {
      // 使用clamdscan进行扫描（更快）
      const result = await this.scanWithClamdscan(filePath);
      result.scanTime = Date.now() - startTime;
      return result;
    } catch (error) {
      // 如果clamdscan失败，尝试使用clamscan
      this.logger.warn(`clamdscan失败，尝试clamscan: ${error}`);
      try {
        const result = await this.scanWithClamscan(filePath);
        result.scanTime = Date.now() - startTime;
        return result;
      } catch (clamscanError) {
        this.logger.error(`病毒扫描失败: ${clamscanError}`);
        // 扫描失败时，为安全起见返回不安全
        return {
          safe: false,
          infected: false,
          details: `扫描失败: ${clamscanError}`,
          scanTime: Date.now() - startTime,
          engine: 'error',
        };
      }
    }
  }

  /**
   * 使用clamdscan扫描（守护进程模式，更快）
   */
  private async scanWithClamdscan(filePath: string): Promise<ScanResult> {
    const absolutePath = path.resolve(filePath);
    
    try {
      const { stdout, stderr } = await execAsync(
        `clamdscan --no-summary "${absolutePath}"`,
        { timeout: this.config.timeout },
      );

      return this.parseScanOutput(stdout || stderr, 'clamdscan');
    } catch (error: any) {
      // clamdscan返回非0退出码表示发现病毒
      if (error.code === 1 && error.stdout) {
        return this.parseScanOutput(error.stdout, 'clamdscan');
      }
      throw error;
    }
  }

  /**
   * 使用clamscan扫描（独立模式，较慢）
   */
  private async scanWithClamscan(filePath: string): Promise<ScanResult> {
    const absolutePath = path.resolve(filePath);
    
    try {
      const { stdout, stderr } = await execAsync(
        `clamscan --no-summary "${absolutePath}"`,
        { timeout: this.config.timeout * 2 }, // clamscan较慢，增加超时
      );

      return this.parseScanOutput(stdout || stderr, 'clamscan');
    } catch (error: any) {
      // clamscan返回非0退出码表示发现病毒
      if (error.code === 1 && error.stdout) {
        return this.parseScanOutput(error.stdout, 'clamscan');
      }
      throw error;
    }
  }

  /**
   * 解析扫描输出
   */
  private parseScanOutput(output: string, engine: string): ScanResult {
    const lines = output.trim().split('\n');
    
    for (const line of lines) {
      // 检查是否发现病毒
      if (line.includes('FOUND')) {
        const match = line.match(/:\s*(.+)\s+FOUND/);
        const virusName = match ? match[1].trim() : 'Unknown';
        
        return {
          safe: false,
          infected: true,
          virusName,
          details: `检测到病毒: ${virusName}`,
          scanTime: 0,
          engine,
        };
      }
      
      // 检查是否安全
      if (line.includes('OK')) {
        return {
          safe: true,
          infected: false,
          details: '文件安全',
          scanTime: 0,
          engine,
        };
      }
    }

    // 无法确定结果
    return {
      safe: true,
      infected: false,
      details: '扫描完成，未发现威胁',
      scanTime: 0,
      engine,
    };
  }

  /**
   * 扫描Buffer数据
   * @param buffer 文件数据
   * @param fileName 文件名（用于临时文件）
   */
  async scanBuffer(buffer: Buffer, fileName: string): Promise<ScanResult> {
    if (!this.config.enabled) {
      return {
        safe: true,
        infected: false,
        details: '病毒扫描已禁用',
        scanTime: 0,
        engine: 'disabled',
      };
    }

    // 创建临时文件
    const tempDir = '/tmp';
    const tempFile = path.join(tempDir, `scan_${Date.now()}_${fileName}`);
    
    try {
      fs.writeFileSync(tempFile, buffer);
      const result = await this.scanFile(tempFile);
      return result;
    } finally {
      // 清理临时文件
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  }

  /**
   * 批量扫描文件
   * @param filePaths 文件路径列表
   */
  async scanFiles(filePaths: string[]): Promise<Map<string, ScanResult>> {
    const results = new Map<string, ScanResult>();
    
    for (const filePath of filePaths) {
      const result = await this.scanFile(filePath);
      results.set(filePath, result);
    }
    
    return results;
  }

  /**
   * 检查服务是否可用
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * 获取服务状态
   */
  async getStatus(): Promise<{
    enabled: boolean;
    available: boolean;
    version?: string;
    databaseVersion?: string;
    lastUpdate?: Date | null;
  }> {
    if (!this.config.enabled) {
      return { enabled: false, available: false };
    }

    try {
      const version = await this.getClamAVVersion();
      const dbInfo = await this.getDatabaseInfo();
      
      return {
        enabled: true,
        available: true,
        version,
        databaseVersion: dbInfo.version,
        lastUpdate: dbInfo.lastUpdate,
      };
    } catch {
      return { enabled: true, available: false };
    }
  }
}
