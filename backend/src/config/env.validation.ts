import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(65535)
  PORT: number = 3000;

  @IsString()
  @IsOptional()
  API_PREFIX: string = 'api';

  @IsString()
  DATABASE_URL: string;

  @IsString()
  @IsOptional()
  JWT_SECRET: string = 'default-secret-key';

  @IsString()
  @IsOptional()
  JWT_ACCESS_EXPIRATION: string = '15m';

  @IsString()
  @IsOptional()
  JWT_REFRESH_EXPIRATION: string = '7d';

  @IsString()
  @IsOptional()
  S3_ENDPOINT: string = 'http://localhost:9000';

  @IsString()
  @IsOptional()
  S3_REGION: string = 'us-east-1';

  @IsString()
  @IsOptional()
  S3_ACCESS_KEY_ID: string = '';

  @IsString()
  @IsOptional()
  S3_SECRET_ACCESS_KEY: string = '';

  @IsString()
  @IsOptional()
  S3_BUCKET_NAME: string = 'bnoa-files';

  @IsString()
  @IsOptional()
  S3_PUBLIC_URL: string = '';

  @IsNumber()
  @IsOptional()
  UPLOAD_MAX_FILE_SIZE: number = 21474836480; // 20GB

  @IsNumber()
  @IsOptional()
  UPLOAD_CHUNK_SIZE: number = 5242880;

  @IsString()
  @IsOptional()
  UPLOAD_ALLOWED_TYPES: string =
    'image/*,video/*,audio/*,application/pdf,text/*';

  @IsNumber()
  @IsOptional()
  THUMBNAIL_WIDTH: number = 300;

  @IsNumber()
  @IsOptional()
  THUMBNAIL_HEIGHT: number = 300;

  @IsNumber()
  @IsOptional()
  THUMBNAIL_QUALITY: number = 80;

  @IsString()
  @IsOptional()
  REDIS_URL: string = '';

  @IsString()
  @IsOptional()
  LOG_LEVEL: string = 'debug';

  @IsString()
  @IsOptional()
  LOG_FORMAT: string = 'combined';
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validatedConfig;
}
