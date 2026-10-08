import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsNumber, IsNotEmpty } from 'class-validator';

export class UpgradeConfigDto {
  @ApiProperty({ description: 'GitHub 仓库所有者' })
  @IsString()
  githubOwner: string;

  @ApiProperty({ description: 'GitHub 仓库名称' })
  @IsString()
  githubRepo: string;

  @ApiPropertyOptional({ description: 'GitHub Token（私有仓库必需）' })
  @IsOptional()
  @IsString()
  githubToken?: string;

  @ApiProperty({ description: 'Docker 镜像前缀' })
  @IsString()
  dockerImagePrefix: string;

  @ApiProperty({ description: '是否启用 Portainer 集成' })
  @IsBoolean()
  portainerEnabled: boolean;

  @ApiPropertyOptional({ description: 'Portainer URL' })
  @IsOptional()
  @IsString()
  portainerUrl?: string;

  @ApiPropertyOptional({ description: 'Portainer API Token' })
  @IsOptional()
  @IsString()
  portainerApiKey?: string;

  @ApiPropertyOptional({ description: 'Portainer 堆栈 ID' })
  @IsOptional()
  @IsNumber()
  portainerStackId?: number;

  @ApiPropertyOptional({ description: 'Portainer 端点 ID' })
  @IsOptional()
  @IsNumber()
  portainerEndpointId?: number;
}

export class ExecuteUpgradeDto {
  @ApiProperty({ description: '目标版本号' })
  @IsString()
  @IsNotEmpty()
  targetVersion: string;
}
