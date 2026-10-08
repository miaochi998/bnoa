import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsIn, IsBoolean, IsString, IsNumber, Min, Max } from 'class-validator';

export class CreateBackupDto {
  @ApiPropertyOptional({ description: '备份内容类型', enum: ['FULL', 'DATABASE', 'FILES'] })
  @IsOptional()
  @IsIn(['FULL', 'DATABASE', 'FILES'])
  backupType?: 'FULL' | 'DATABASE' | 'FILES';

  @ApiPropertyOptional({ description: '存储类型', enum: ['LOCAL', 'RUSTFS'] })
  @IsOptional()
  @IsIn(['LOCAL', 'RUSTFS'])
  storageType?: 'LOCAL' | 'RUSTFS';

  @ApiPropertyOptional({ description: '触发类型', enum: ['MANUAL', 'SCHEDULED', 'AUTO_BEFORE_RESTORE'] })
  @IsOptional()
  @IsIn(['MANUAL', 'SCHEDULED', 'AUTO_BEFORE_RESTORE'])
  triggerType?: 'MANUAL' | 'SCHEDULED' | 'AUTO_BEFORE_RESTORE';
}

export class BackupConfigDto {
  @ApiProperty({ description: '是否启用备份功能' })
  @IsBoolean()
  enabled: boolean;

  @ApiProperty({ description: '定时备份 cron 表达式' })
  @IsString()
  scheduleCron: string;

  @ApiProperty({ description: '保留天数' })
  @IsNumber()
  @Min(1)
  @Max(365)
  retentionDays: number;

  @ApiProperty({ description: '默认存储类型' })
  @IsIn(['LOCAL', 'RUSTFS'])
  storageType: 'LOCAL' | 'RUSTFS';

  @ApiPropertyOptional({ description: '本地上传根目录相对路径' })
  @IsOptional()
  @IsString()
  localPath?: string;

  @ApiPropertyOptional({ description: 'RustFS 桶名' })
  @IsOptional()
  @IsString()
  rustfsBucket?: string;

  @ApiPropertyOptional({ description: 'RustFS 路径前缀' })
  @IsOptional()
  @IsString()
  rustfsPrefix?: string;

  @ApiProperty({ description: '是否包含数据库' })
  @IsBoolean()
  includeDatabase: boolean;

  @ApiProperty({ description: '是否包含上传文件' })
  @IsBoolean()
  includeFiles: boolean;
}

export class RestoreBackupDto {
  @ApiProperty({ description: '确认恢复操作，必须为 true' })
  @IsBoolean()
  @IsIn([true], { message: 'confirm must be true' })
  confirm: boolean;

  @ApiPropertyOptional({ description: '仅恢复指定内容类型，不传则全部恢复', enum: ['DATABASE', 'FILES'] })
  @IsOptional()
  @IsIn(['DATABASE', 'FILES'])
  contentTypes?: 'DATABASE' | 'FILES';

  @ApiPropertyOptional({ description: '仅恢复指定内容类型（逗号分隔）' })
  @IsOptional()
  @IsString()
  contentTypesStr?: string;

  @ApiPropertyOptional({ description: '是否在恢复前创建自动备份，默认为 true' })
  @IsOptional()
  @IsBoolean()
  createAutoBackup?: boolean;

  @ApiPropertyOptional({ description: '恢复类型', enum: ['FULL', 'DATABASE', 'FILES'] })
  @IsOptional()
  @IsIn(['FULL', 'DATABASE', 'FILES'])
  restoreType?: 'FULL' | 'DATABASE' | 'FILES';
}

export class BackupQueryDto {
  @ApiPropertyOptional({ description: '页码' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '每页数量' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  pageSize?: number = 10;

  @ApiPropertyOptional({ description: '状态筛选' })
  @IsOptional()
  @IsIn(['running', 'success', 'failed'])
  status?: 'running' | 'success' | 'failed';

  @ApiPropertyOptional({ description: '触发类型筛选' })
  @IsOptional()
  @IsIn(['MANUAL', 'SCHEDULED'])
  triggerType?: 'MANUAL' | 'SCHEDULED';
}

export class RestoreQueryDto {
  @ApiPropertyOptional({ description: '页码' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '每页数量' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  pageSize?: number = 10;

  @ApiPropertyOptional({ description: '关联的备份 ID' })
  @IsOptional()
  @IsString()
  backupId?: string;
}
