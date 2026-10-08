/**
 * 病毒扫描服务（参照7DL项目实现）
 * 支持本地开发环境和Docker生产环境
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as net from 'net';

const execAsync = promisify(exec);

export interface ScanResult {
  isClean: boolean;
  threats: string[];
  scanDetails: string;
  scanTime: number;
}

@Injectable()
export class VirusScannerService {
  private readonly logger = new Logger(VirusScannerService.name);
  
  // ClamAV 配置
  private readonly clamavHost: string;
  private readonly clamavPort: number;
  private readonly localClamScanPath: string;
  private readonly localSocketPath: string;
  private readonly useNetworkMode: boolean;
  private readonly enabled: boolean;

  constructor(private readonly configService: ConfigService) {
    this.clamavHost = this.configService.get<string>('CLAMAV_HOST', 'clamav');
    this.clamavPort = this.configService.get<number>('CLAMAV_PORT', 3310);
    this.localClamScanPath = this.configService.get<string>('CLAMAV_SCAN_PATH', '/opt/homebrew/bin/clamdscan');
    this.localSocketPath = this.configService.get<string>('CLAMAV_SOCKET', '/tmp/clamd.socket');
    this.useNetworkMode = this.configService.get<string>('NODE_ENV') === 'production' || 
                          !!this.configService.get<string>('CLAMAV_HOST');
    this.enabled = this.configService.get<boolean>('CLAMAV_ENABLED', true);

    if (this.enabled) {
      this.checkAvailability();
    }
  }

  /**
   * 初始化时检查ClamAV可用性
   */
  private async checkAvailability(): Promise<void> {
    const available = await this.isAvailable();
    if (available) {
      this.logger.log('✅ ClamAV病毒扫描服务已连接');
    } else {
      this.logger.warn('⚠️ ClamAV不可用，病毒扫描将被跳过');
    }
  }

  /**
   * 检查ClamAV是否可用
   */
  async isAvailable(): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    try {
      if (this.useNetworkMode) {
        return await this.checkNetworkConnection();
      } else {
        await fs.access(this.localClamScanPath);
        await fs.access(this.localSocketPath);
        return true;
      }
    } catch (error) {
      return false;
    }
  }

  /**
   * 检查网络连接（Docker 环境）
   */
  private checkNetworkConnection(): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      const timeout = 3000;

      socket.setTimeout(timeout);

      socket.on('connect', () => {
        socket.write('PING\n');
      });

      socket.on('data', (data) => {
        const response = data.toString().trim();
        socket.destroy();
        resolve(response === 'PONG');
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });

      socket.on('error', () => {
        socket.destroy();
        resolve(false);
      });

      socket.connect(this.clamavPort, this.clamavHost);
    });
  }

  /**
   * 扫描文件
   */
  async scanFile(filePath: string): Promise<ScanResult> {
    const startTime = Date.now();

    try {
      const available = await this.isAvailable();
      if (!available) {
        this.logger.warn(`跳过病毒扫描: ${filePath} (ClamAV不可用)`);
        return {
          isClean: true,
          threats: [],
          scanDetails: 'ClamAV不可用，跳过扫描',
          scanTime: Date.now() - startTime,
        };
      }

      await fs.access(filePath);

      if (this.useNetworkMode) {
        return await this.scanFileViaNetwork(filePath, startTime);
      } else {
        return await this.scanFileViaCommand(filePath, startTime);
      }
    } catch (error: any) {
      const scanTime = Date.now() - startTime;
      
      // clamdscan命令执行错误（通常是发现病毒，退出码为1）
      if (error.code === 1 && error.stdout) {
        const output = error.stdout + (error.stderr || '');
        const threats: string[] = [];
        
        const foundMatches = output.match(/: (.+?) FOUND/g);
        if (foundMatches) {
          foundMatches.forEach((match: string) => {
            const threat = match.replace(/: (.+?) FOUND/, '$1').trim();
            threats.push(threat);
          });
        }

        this.logger.warn(`🦠 检测到病毒: ${filePath} - ${threats.join(', ')}`);

        return {
          isClean: false,
          threats,
          scanDetails: output.trim(),
          scanTime,
        };
      }

      this.logger.error(`病毒扫描失败: ${filePath}`, error);
      throw error;
    }
  }

  /**
   * 通过本地命令扫描文件（macOS 开发环境）
   */
  private async scanFileViaCommand(filePath: string, startTime: number): Promise<ScanResult> {
    const { stdout, stderr } = await execAsync(
      `${this.localClamScanPath} --fdpass "${filePath}"`,
    );

    const scanTime = Date.now() - startTime;
    const output = stdout + stderr;

    this.logger.log(`扫描完成: ${filePath} (${scanTime}ms)`);

    const isClean = output.includes('OK') && !output.includes('FOUND');
    const threats: string[] = [];

    if (!isClean) {
      const foundMatches = output.match(/: (.+?) FOUND/g);
      if (foundMatches) {
        foundMatches.forEach((match) => {
          const threat = match.replace(/: (.+?) FOUND/, '$1').trim();
          threats.push(threat);
        });
      }
    }

    return {
      isClean,
      threats,
      scanDetails: output.trim(),
      scanTime,
    };
  }

  /**
   * 通过网络扫描文件（Docker 环境）
   */
  private async scanFileViaNetwork(filePath: string, startTime: number): Promise<ScanResult> {
    return new Promise(async (resolve, reject) => {
      try {
        const fileBuffer = await fs.readFile(filePath);
        const socket = new net.Socket();
        const timeout = 60000;
        let response = '';

        socket.setTimeout(timeout);

        socket.on('connect', () => {
          socket.write('zINSTREAM\0');
          
          const sizeBuffer = Buffer.alloc(4);
          sizeBuffer.writeUInt32BE(fileBuffer.length, 0);
          socket.write(sizeBuffer);
          
          socket.write(fileBuffer);
          
          const endBuffer = Buffer.alloc(4);
          endBuffer.writeUInt32BE(0, 0);
          socket.write(endBuffer);
        });

        socket.on('data', (data) => {
          response += data.toString();
        });

        socket.on('end', () => {
          const scanTime = Date.now() - startTime;
          const output = response.trim();
          
          this.logger.log(`扫描完成: ${filePath} (${scanTime}ms) - ${output}`);

          const isClean = output.includes('OK') && !output.includes('FOUND');
          const threats: string[] = [];

          if (!isClean) {
            const foundMatches = output.match(/: (.+?) FOUND/g);
            if (foundMatches) {
              foundMatches.forEach((match) => {
                const threat = match.replace(/: (.+?) FOUND/, '$1').trim();
                threats.push(threat);
              });
            }
            this.logger.warn(`🦠 检测到病毒: ${filePath} - ${threats.join(', ')}`);
          }

          resolve({
            isClean,
            threats,
            scanDetails: output,
            scanTime,
          });
        });

        socket.on('timeout', () => {
          socket.destroy();
          reject(new Error('ClamAV 扫描超时'));
        });

        socket.on('error', (err) => {
          socket.destroy();
          reject(err);
        });

        socket.connect(this.clamavPort, this.clamavHost);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 扫描Buffer内容
   */
  async scanBuffer(buffer: Buffer, fileName: string): Promise<ScanResult> {
    const tempFilePath = `/tmp/scan_${Date.now()}_${fileName}`;
    
    try {
      await fs.writeFile(tempFilePath, buffer);
      const result = await this.scanFile(tempFilePath);
      await fs.unlink(tempFilePath);
      return result;
    } catch (error) {
      try {
        await fs.unlink(tempFilePath);
      } catch {
        // 忽略清理错误
      }
      throw error;
    }
  }

  /**
   * 获取服务状态
   */
  async getStatus(): Promise<{
    enabled: boolean;
    available: boolean;
    mode: string;
    host?: string;
    port?: number;
  }> {
    const available = await this.isAvailable();
    return {
      enabled: this.enabled,
      available,
      mode: this.useNetworkMode ? 'network' : 'local',
      host: this.useNetworkMode ? this.clamavHost : undefined,
      port: this.useNetworkMode ? this.clamavPort : undefined,
    };
  }
}
