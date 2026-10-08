import {
    Controller,
    Get,
    Post,
    Delete,
    Body,
    Param,
    Query,
    Res,
    UseGuards,
    HttpCode,
    HttpStatus,
    UseInterceptors,
    UploadedFile,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiBearerAuth,
    ApiConsumes,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import * as fs from 'fs';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import {
    CurrentUser,
    UserPayload,
} from '../../common/decorators/current-user.decorator';
import { ExportService } from './services/export.service';
import { ImportService } from './services/import.service';
import { ExportTaskService } from './services/export-task.service';
import {
    CreateExportDto,
    QueryTaskDto,
} from './dto/create-export.dto';

@ApiTags('export-import')
@Controller('export-import')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class ExportImportController {
    constructor(
        private readonly exportService: ExportService,
        private readonly importService: ImportService,
        private readonly taskService: ExportTaskService,
    ) {}

    /** 获取可导出模块列表 */
    @Get('modules')
    @Permissions('export-import:export')
    @ApiOperation({ summary: '获取可导出模块列表' })
    getModules() {
        return {
            success: true,
            data: this.exportService.getModules(),
        };
    }

    /** 创建导出任务 */
    @Post('export')
    @Permissions('export-import:export')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '创建导出任务' })
    async createExport(
        @Body() dto: CreateExportDto,
        @CurrentUser() user: UserPayload,
    ) {
        const result =
            await this.exportService.createExport({
                module: dto.module,
                format: dto.format,
                params: dto.params,
                userId: user.sub,
            });
        return {
            success: true,
            message: result.async
                ? '导出任务已提交，完成后将通知您'
                : '导出完成',
            data: result,
        };
    }

    /** 获取任务列表 */
    @Get('tasks')
    @Permissions('export-import:task-list')
    @ApiOperation({ summary: '获取任务列表' })
    async getTasks(
        @Query() query: QueryTaskDto,
        @CurrentUser() user: UserPayload,
    ) {
        const result = await this.taskService.listTasks({
            ...query,
            userId: user.sub,
            page: query.page
                ? Number(query.page) : 1,
            pageSize: query.pageSize
                ? Number(query.pageSize) : 20,
        });
        return {
            success: true,
            data: result.items,
            meta: result.meta,
        };
    }

    /** 获取任务详情 */
    @Get('tasks/:id')
    @Permissions('export-import:task-list')
    @ApiOperation({ summary: '获取任务详情' })
    async getTask(@Param('id') id: string) {
        const task = await this.taskService.getTask(id);
        return {
            success: true,
            data: {
                ...task,
                fileSize: task.fileSize
                    ? Number(task.fileSize) : null,
            },
        };
    }

    /** 下载导出文件 */
    @Get('download/:id')
    @Permissions('export-import:export')
    @ApiOperation({ summary: '下载导出文件' })
    async download(
        @Param('id') id: string,
        @Res() res: Response,
    ) {
        const task = await this.taskService.getTask(id);
        if (
            task.status !== 'completed' ||
            !task.filePath
        ) {
            res.status(400).json({
                success: false,
                message: '文件不可用',
            });
            return;
        }
        if (!fs.existsSync(task.filePath)) {
            res.status(404).json({
                success: false,
                message: '文件已过期或不存在',
            });
            return;
        }

        // 根据格式设置 Content-Type
        const contentTypeMap: Record<string, string> = {
            xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            csv: 'text/csv; charset=utf-8',
            json: 'application/json; charset=utf-8',
        };
        const ext = task.format || 'xlsx';
        const contentType = contentTypeMap[ext]
            || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);

        // 文件名：RFC 5987 编码 + ASCII 回退
        const rawName = task.fileName || `export.${ext}`;
        const encodedName = encodeURIComponent(rawName)
            .replace(/['()]/g, escape)
            .replace(/\*/g, '%2A');
        const asciiName = rawName.replace(
            /[^\x20-\x7E]/g, '_',
        );
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`,
        );

        // 文件大小
        const stat = fs.statSync(task.filePath);
        res.setHeader('Content-Length', stat.size);

        const stream = fs.createReadStream(task.filePath);
        stream.pipe(res);
    }

    /** 删除任务 */
    @Delete('tasks/:id')
    @Permissions('export-import:task-delete')
    @ApiOperation({ summary: '删除任务' })
    async deleteTask(@Param('id') id: string) {
        const task =
            await this.taskService.deleteTask(id);
        // 清理文件
        if (task.filePath && fs.existsSync(task.filePath)) {
            fs.unlinkSync(task.filePath);
        }
        return {
            success: true,
            message: '任务已删除',
        };
    }

    /** 导入预览 */
    @Post('import/preview')
    @Permissions('export-import:import')
    @HttpCode(HttpStatus.OK)
    @UseInterceptors(FileInterceptor('file'))
    @ApiConsumes('multipart/form-data')
    @ApiOperation({ summary: '导入预览' })
    async importPreview(
        @UploadedFile() file: Express.Multer.File,
        @Query('module') moduleName: string,
    ) {
        if (!file) {
            return {
                success: false,
                message: '请上传文件',
            };
        }
        const result = await this.importService.preview(
            moduleName,
            file.buffer,
            file.originalname,
        );
        return {
            success: true,
            data: result,
        };
    }

    /** 确认导入 */
    @Post('import/confirm')
    @Permissions('export-import:import')
    @HttpCode(HttpStatus.OK)
    @UseInterceptors(FileInterceptor('file'))
    @ApiConsumes('multipart/form-data')
    @ApiOperation({ summary: '确认导入' })
    async importConfirm(
        @UploadedFile() file: Express.Multer.File,
        @Query('module') moduleName: string,
        @CurrentUser() user: UserPayload,
    ) {
        if (!file) {
            return {
                success: false,
                message: '请上传文件',
            };
        }
        const result = await this.importService.confirm(
            moduleName,
            file.buffer,
            file.originalname,
            user.sub,
        );
        return {
            success: true,
            message:
                `导入完成：成功${result.success}条` +
                (result.failed > 0
                    ? `，失败${result.failed}条` : '') +
                (result.skipped > 0
                    ? `，跳过${result.skipped}条` : ''),
            data: result,
        };
    }
}
