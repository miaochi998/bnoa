import {
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';

@Injectable()
export class ExportTaskService {
    private readonly logger =
        new Logger(ExportTaskService.name);

    constructor(
        private readonly prisma: PrismaService,
    ) {}

    /** 生成任务编号 ET-YYYYMMDDHHmmss-XXX */
    generateTaskNo(): string {
        const now = new Date();
        const ts = now.toISOString()
            .replace(/[-T:]/g, '')
            .slice(0, 14);
        const rand = Math.floor(
            Math.random() * 1000,
        ).toString().padStart(3, '0');
        return `ET-${ts}-${rand}`;
    }

    /** 创建任务 */
    async createTask(data: {
        module: string;
        type: string;
        format: string;
        params?: any;
        userId: string;
        totalRows?: number;
    }) {
        const expiresAt = new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000,
        );
        const task =
            await this.prisma.exportTask.create({
                data: {
                    taskNo: this.generateTaskNo(),
                    module: data.module,
                    type: data.type,
                    format: data.format,
                    status: 'pending',
                    params: data.params || null,
                    userId: data.userId,
                    totalRows: data.totalRows,
                    expiresAt,
                },
            });
        this.logger.log(
            `任务创建: ${task.taskNo} [${data.type}:${data.module}]`,
        );
        return task;
    }

    /** 更新任务状态 */
    async updateTask(
        id: string,
        data: {
            status?: string;
            fileName?: string;
            filePath?: string;
            fileSize?: bigint;
            totalRows?: number;
            processedRows?: number;
            errorMessage?: string;
        },
    ) {
        return this.prisma.exportTask.update({
            where: { id },
            data,
        });
    }

    /** 获取任务详情 */
    async getTask(id: string) {
        const task =
            await this.prisma.exportTask.findUnique({
                where: { id },
            });
        if (!task) {
            throw new NotFoundException(
                '任务不存在',
            );
        }
        return task;
    }

    /** 查询任务列表 */
    async listTasks(query: {
        userId?: string;
        module?: string;
        type?: string;
        status?: string;
        page?: number;
        pageSize?: number;
    }) {
        const where: any = {};
        if (query.userId) where.userId = query.userId;
        if (query.module) where.module = query.module;
        if (query.type) where.type = query.type;
        if (query.status) where.status = query.status;

        const page = query.page || 1;
        const pageSize = query.pageSize || 20;

        const [items, total] = await Promise.all([
            this.prisma.exportTask.findMany({
                where,
                skip: (page - 1) * pageSize,
                take: pageSize,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.exportTask.count({ where }),
        ]);

        return {
            items: items.map((item) => ({
                ...item,
                fileSize: item.fileSize
                    ? Number(item.fileSize)
                    : null,
            })),
            meta: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(
                    total / pageSize,
                ),
            },
        };
    }

    /** 删除任务 */
    async deleteTask(id: string) {
        const task = await this.getTask(id);
        await this.prisma.exportTask.delete({
            where: { id: task.id },
        });
        this.logger.log(
            `任务删除: ${task.taskNo}`,
        );
        return task;
    }

    /** 清理过期任务 */
    async cleanupExpiredTasks(): Promise<number> {
        const result =
            await this.prisma.exportTask.deleteMany({
                where: {
                    expiresAt: { lt: new Date() },
                },
            });
        return result.count;
    }
}
