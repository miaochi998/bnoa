import {
  Injectable,
  Logger,
  OnModuleInit,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 本地存储服务
 * 处理本地文件系统的文件和目录操作
 */
@Injectable()
export class LocalStorageService implements OnModuleInit {
  private readonly logger = new Logger(LocalStorageService.name);
  private uploadRoot: string;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    // 从环境变量获取本地上传根目录
    this.uploadRoot = this.configService.get<string>('LOCAL_UPLOAD_ROOT', './uploads');
    
    // 确保上传根目录存在
    await this.ensureDirectoryExists(this.uploadRoot);
    
    this.logger.log(`本地存储服务初始化完成，根目录: ${this.uploadRoot}`);
  }

  /**
   * 获取上传根目录
   */
  getUploadRoot(): string {
    return this.uploadRoot;
  }

  /**
   * 确保目录存在，如果不存在则创建
   * @param dirPath 目录路径
   */
  async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      const absolutePath = this.getAbsolutePath(dirPath);
      
      if (!fs.existsSync(absolutePath)) {
        fs.mkdirSync(absolutePath, { recursive: true });
        this.logger.log(`创建本地目录: ${absolutePath}`);
      }
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`创建本地目录失败: ${dirPath}`, err.stack);
      throw new InternalServerErrorException(`创建本地目录失败: ${err.message}`);
    }
  }

  /**
   * 创建文件夹
   * @param folderPath 相对于上传根目录的文件夹路径
   */
  async createFolder(folderPath: string): Promise<void> {
    try {
      // 移除开头和结尾的斜杠
      const normalizedPath = folderPath.replace(/^\/+|\/+$/g, '');
      const absolutePath = path.join(this.uploadRoot, normalizedPath);

      this.logger.debug(`在本地存储中创建目录: ${absolutePath}`);

      if (!fs.existsSync(absolutePath)) {
        fs.mkdirSync(absolutePath, { recursive: true });
        this.logger.log(`本地目录创建成功: ${absolutePath}`);
      } else {
        this.logger.debug(`本地目录已存在: ${absolutePath}`);
      }
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`本地目录创建失败: ${folderPath}`, err.stack);
      throw new InternalServerErrorException(`本地目录创建失败: ${err.message}`);
    }
  }

  /**
   * 检查文件夹是否存在
   * @param folderPath 相对于上传根目录的文件夹路径
   */
  folderExists(folderPath: string): boolean {
    const normalizedPath = folderPath.replace(/^\/+|\/+$/g, '');
    const absolutePath = path.join(this.uploadRoot, normalizedPath);
    return fs.existsSync(absolutePath) && fs.statSync(absolutePath).isDirectory();
  }

  /**
   * 删除文件夹（仅当为空时）
   * @param folderPath 相对于上传根目录的文件夹路径
   */
  async deleteFolder(folderPath: string): Promise<void> {
    try {
      const normalizedPath = folderPath.replace(/^\/+|\/+$/g, '');
      const absolutePath = path.join(this.uploadRoot, normalizedPath);

      if (fs.existsSync(absolutePath)) {
        const files = fs.readdirSync(absolutePath);
        if (files.length > 0) {
          throw new Error('目录不为空，无法删除');
        }
        fs.rmdirSync(absolutePath);
        this.logger.log(`本地目录删除成功: ${absolutePath}`);
      }
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`本地目录删除失败: ${folderPath}`, err.stack);
      throw new InternalServerErrorException(`本地目录删除失败: ${err.message}`);
    }
  }

  /**
   * 上传文件到本地存储
   * @param buffer 文件内容
   * @param filePath 相对于上传根目录的文件路径
   */
  async uploadFile(buffer: Buffer, filePath: string): Promise<string> {
    try {
      const normalizedPath = filePath.replace(/^\/+/, '');
      const absolutePath = path.join(this.uploadRoot, normalizedPath);
      const dirPath = path.dirname(absolutePath);

      // 确保目录存在
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      fs.writeFileSync(absolutePath, buffer);
      this.logger.log(`文件上传成功: ${absolutePath}`);

      return absolutePath;
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`文件上传失败: ${filePath}`, err.stack);
      throw new InternalServerErrorException(`文件上传失败: ${err.message}`);
    }
  }

  /**
   * 下载文件
   * @param filePath 相对于上传根目录的文件路径
   */
  async downloadFile(filePath: string): Promise<Buffer> {
    try {
      const normalizedPath = filePath.replace(/^\/+/, '');
      const absolutePath = path.join(this.uploadRoot, normalizedPath);

      if (!fs.existsSync(absolutePath)) {
        throw new Error('文件不存在');
      }

      return fs.readFileSync(absolutePath);
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`文件下载失败: ${filePath}`, err.stack);
      throw new InternalServerErrorException(`文件下载失败: ${err.message}`);
    }
  }

  /**
   * 删除文件
   * @param filePath 相对于上传根目录的文件路径
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      const normalizedPath = filePath.replace(/^\/+/, '');
      const absolutePath = path.join(this.uploadRoot, normalizedPath);

      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
        this.logger.log(`文件删除成功: ${absolutePath}`);
      }
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`文件删除失败: ${filePath}`, err.stack);
      throw new InternalServerErrorException(`文件删除失败: ${err.message}`);
    }
  }

  /**
   * 检查文件是否存在
   * @param filePath 相对于上传根目录的文件路径
   */
  fileExists(filePath: string): boolean {
    const normalizedPath = filePath.replace(/^\/+/, '');
    const absolutePath = path.join(this.uploadRoot, normalizedPath);
    return fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile();
  }

  /**
   * 获取绝对路径
   * @param relativePath 相对路径
   */
  private getAbsolutePath(relativePath: string): string {
    if (path.isAbsolute(relativePath)) {
      return relativePath;
    }
    return path.resolve(process.cwd(), relativePath);
  }
}
