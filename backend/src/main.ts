import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import helmet from 'helmet';
import * as path from 'path';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // 安全中间件 - 配置helmet允许静态资源访问和iframe嵌入
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
    frameguard: false, // 禁用X-Frame-Options，允许iframe嵌入
  }));
  app.use(compression());

  // CORS配置
  // 注意：origin='*' 与 credentials=true 不兼容，浏览器会拒绝请求
  // 统一使用回调函数：有白名单时校验，否则全部放行
  const corsOrigin = process.env.CORS_ORIGIN;
  const allowedOrigins = corsOrigin && corsOrigin !== '*'
    ? corsOrigin.split(',').map(s => s.trim())
    : null;
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // 无 origin（如服务端请求）或无白名单限制时，全部放行
      if (!origin || !allowedOrigins) {
        callback(null, true);
        return;
      }
      // 白名单匹配或同 IP 不同端口的请求放行
      if (allowedOrigins.includes(origin) || /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$/.test(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS: Origin ${origin} not allowed`));
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    // 允许前端读取下载文件名等响应头（例如备份下载的 Content-Disposition）
    exposedHeaders: ['Content-Disposition', 'content-disposition'],
  });

  // 静态文件服务 - 提供本地上传的文件访问
  const uploadRoot = process.env.LOCAL_UPLOAD_ROOT || './uploads';
  app.useStaticAssets(path.resolve(uploadRoot), {
    prefix: '/uploads/',
  });

  // 全局管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // 全局过滤器
  app.useGlobalFilters(new HttpExceptionFilter());

  // 全局拦截器
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(),
  );

  // API前缀 - 支持动态版本号，避免硬编码
  // 格式: /api/v1, /api/v2 等
  const apiVersion = process.env.API_VERSION || 'v1';
  const apiPrefix = `/api/${apiVersion}`;
  app.setGlobalPrefix(apiPrefix);

  // Swagger文档
  const config = new DocumentBuilder()
    .setTitle('BNOA API')
    .setDescription('BNOA 办公系统 API 文档')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // 启动服务
  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');

  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`API Documentation: http://localhost:${port}/api/docs`);
}

void bootstrap();
