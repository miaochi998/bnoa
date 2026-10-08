import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class HealthCheckService {
  private readonly logger = new Logger(HealthCheckService.name);

  private readonly isContainerEnv = process.env.NODE_ENV === 'production';
  private readonly containerPort = '3000';

  private readonly externalPorts = {
    backend: process.env.BACKEND_PORT || '6520',
    frontend: process.env.FRONTEND_PORT || '6521',
  };

  private readonly serviceNames = {
    backend: 'backend',
    frontend: 'frontend',
  };

  private getServiceUrl(service: 'backend' | 'frontend'): string {
    if (this.isContainerEnv) {
      return `http://${this.serviceNames[service]}:${this.containerPort}`;
    } else {
      return `http://localhost:${this.externalPorts[service]}`;
    }
  }

  async checkBackendHealth(
    retries: number = 3,
    interval: number = 5000,
  ): Promise<{
    healthy: boolean;
    attempts: number;
    lastError?: string;
  }> {
    const baseUrl = this.getServiceUrl('backend');
    const healthUrl = `${baseUrl}/api/v1/health`;

    for (let i = 0; i < retries; i++) {
      try {
        this.logger.log(`后端健康检查 (${i + 1}/${retries})... URL: ${healthUrl}`);
        const response = await axios.get(healthUrl, { timeout: 5000 });

        if (response.status === 200) {
          this.logger.log('后端健康检查通过');
          return { healthy: true, attempts: i + 1 };
        }
      } catch (error) {
        this.logger.warn(`健康检查失败: ${error.message}`);
        if (i < retries - 1) {
          await this.sleep(interval);
        } else {
          return { healthy: false, attempts: retries, lastError: error.message };
        }
      }
    }

    return { healthy: false, attempts: retries, lastError: '超过最大重试次数' };
  }

  async checkFrontendHealth(): Promise<{
    healthy: boolean;
    error?: string;
  }> {
    try {
      const frontendUrl = this.getServiceUrl('frontend');
      this.logger.log(`检查前端健康状态: ${frontendUrl}`);
      const response = await axios.get(frontendUrl, { timeout: 5000 });
      return { healthy: response.status === 200 };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }

  async checkDatabaseHealth(): Promise<{
    healthy: boolean;
    error?: string;
  }> {
    try {
      const baseUrl = this.getServiceUrl('backend');
      const response = await axios.get(`${baseUrl}/api/v1/health`, { timeout: 5000 });
      return { healthy: response.status === 200 };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }

  async checkAllServices(): Promise<{
    overall: boolean;
    services: {
      backend: { healthy: boolean; error?: string };
      frontend: { healthy: boolean; error?: string };
      database: { healthy: boolean; error?: string };
    };
  }> {
    const [backend, frontend, database] = await Promise.all([
      this.checkBackendHealth(1, 0),
      this.checkFrontendHealth(),
      this.checkDatabaseHealth(),
    ]);

    const services = {
      backend: { healthy: backend.healthy, error: backend.lastError },
      frontend,
      database,
    };

    const overall = Object.values(services).every((s) => s.healthy);

    return { overall, services };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
