import {
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import {
    CreateTalentDto,
    UpdateTalentDto,
    TalentQueryDto,
} from './dto/talent.dto';
import {
    CreateTalentPlatformDto,
    UpdateTalentPlatformDto,
} from './dto/talent-platform.dto';
import {
    CreateTalentContactLogDto,
    TalentContactLogQueryDto,
} from './dto/talent-contact-log.dto';
import { CreateTalentTransferDto } from './dto/talent-transfer.dto';
import {
    SetTalentFlagDto,
    SaveFlagConfigsDto,
} from './dto/talent-flag.dto';

const MANAGER_SELECT = {
    id: true, username: true, name: true,
};

@Injectable()
export class TalentService {
    private readonly logger = new Logger(TalentService.name);

    constructor(private readonly prisma: PrismaService) {}

    private isAdmin(roles: string[]): boolean {
        return roles.includes('super_admin');
    }

    private async getTalent(
        id: string,
        userId: string,
        roles: string[],
    ) {
        const where: any = { id, deletedAt: null };
        if (!this.isAdmin(roles)) {
            where.managerId = userId;
        }
        const talent = await this.prisma.talent.findFirst({
            where,
        });
        if (!talent) {
            throw new NotFoundException('达人不存在或无权访问');
        }
        return talent;
    }

    // ========== 达人 CRUD ==========

    async create(dto: CreateTalentDto, userId: string) {
        const talent = await this.prisma.talent.create({
            data: {
                ...dto,
                managerId: userId,
                createdBy: userId,
            },
        });
        this.logger.log(`达人创建成功: ${talent.name}`);
        return talent;
    }

    async update(
        id: string,
        dto: UpdateTalentDto,
        userId: string,
        roles: string[],
    ) {
        await this.getTalent(id, userId, roles);
        const updated = await this.prisma.talent.update({
            where: { id },
            data: { ...dto, updatedBy: userId },
        });
        this.logger.log(`达人更新成功: ${updated.name}`);
        return updated;
    }

    async delete(
        id: string,
        userId: string,
        roles: string[],
    ) {
        const talent = await this.getTalent(id, userId, roles);
        await this.prisma.talent.update({
            where: { id },
            data: { deletedAt: new Date(), updatedBy: userId },
        });
        this.logger.log(`达人删除成功: ${talent.name}`);
    }

    async findById(
        id: string,
        userId: string,
        roles: string[],
    ) {
        const where: any = { id, deletedAt: null };
        if (!this.isAdmin(roles)) {
            where.managerId = userId;
        }
        const talent = await this.prisma.talent.findFirst({
            where,
            include: { manager: { select: MANAGER_SELECT },
                talentPlatforms: {
                    where: { deletedAt: null },
                    orderBy: { createdAt: 'desc' as const },
                },
                talentFlags: {
                    where: { userId },
                    select: { id: true, flagColor: true },
                },
            },
        });
        if (!talent) {
            throw new NotFoundException('达人不存在或无权访问');
        }
        return this.mapTalent(talent);
    }

    async findAll(
        query: TalentQueryDto,
        userId: string,
        roles: string[],
    ) {
        const {
            keyword, status, level,
            flagColor, managerId, platform,
        } = query;
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 10;
        const where: any = { deletedAt: null };

        if (!this.isAdmin(roles)) {
            where.managerId = userId;
        } else if (managerId) {
            where.managerId = managerId;
        }

        if (status) where.status = status;
        if (level) where.level = level;

        if (keyword) {
            where.OR = [
                { name: { contains: keyword, mode: 'insensitive' } },
                { wechat: { contains: keyword, mode: 'insensitive' } },
                { phone: { contains: keyword, mode: 'insensitive' } },
            ];
        }

        if (platform) {
            where.talentPlatforms = {
                some: { platform, deletedAt: null },
            };
        }

        if (flagColor) {
            where.talentFlags = { some: { userId, flagColor } };
        }

        const skip = (page - 1) * pageSize;
        const [list, total] = await Promise.all([
            this.prisma.talent.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { createdAt: 'desc' },
                include: { manager: { select: MANAGER_SELECT },
                    talentPlatforms: {
                        where: { deletedAt: null },
                        select: {
                            id: true,
                            platform: true,
                            nickname: true,
                        },
                    },
                    talentFlags: {
                        where: { userId },
                        select: {
                            id: true,
                            flagColor: true,
                        },
                    },
                },
            }),
            this.prisma.talent.count({ where }),
        ]);

        return {
            list: list.map((t: any) => this.mapTalent(t)),
            pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize),
            },
        };
    }

    async findAllForSelect(userId: string, roles: string[]) {
        const where: any = { deletedAt: null };
        if (!this.isAdmin(roles)) {
            where.managerId = userId;
        }
        return this.prisma.talent.findMany({
            where,
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
        });
    }

    // ========== 平台账号管理 ==========

    async createPlatform(
        talentId: string,
        dto: CreateTalentPlatformDto,
        userId: string,
        roles: string[],
    ) {
        await this.getTalent(talentId, userId, roles);
        return this.prisma.talentPlatform.create({
            data: { ...dto, talentId },
        });
    }

    async updatePlatform(
        id: string,
        dto: UpdateTalentPlatformDto,
        userId: string,
        roles: string[],
    ) {
        const p = await this.getPlatformWithAccess(
            id, userId, roles,
        );
        return this.prisma.talentPlatform.update({
            where: { id: p.id },
            data: dto,
        });
    }

    async deletePlatform(
        id: string,
        userId: string,
        roles: string[],
    ) {
        const p = await this.getPlatformWithAccess(
            id, userId, roles,
        );
        await this.prisma.talentPlatform.update({
            where: { id: p.id },
            data: { deletedAt: new Date() },
        });
    }

    private async getPlatformWithAccess(
        id: string,
        userId: string,
        roles: string[],
    ) {
        const p = await this.prisma.talentPlatform.findFirst({
            where: { id, deletedAt: null },
            include: {
                talent: {
                    select: {
                        managerId: true,
                        deletedAt: true,
                    },
                },
            },
        });
        if (!p || p.talent.deletedAt) {
            throw new NotFoundException('平台账号不存在');
        }
        if (
            !this.isAdmin(roles) &&
            p.talent.managerId !== userId
        ) {
            throw new NotFoundException('平台账号不存在或无权访问');
        }
        return p;
    }

    // ========== 沟通记录 ==========

    async createContactLog(
        talentId: string,
        dto: CreateTalentContactLogDto,
        userId: string,
        roles: string[],
    ) {
        await this.getTalent(talentId, userId, roles);
        return this.prisma.talentContactLog.create({
            data: {
                talentId,
                content: dto.content,
                creatorId: userId,
            },
            include: { creator: { select: MANAGER_SELECT },
            },
        });
    }

    async findContactLogs(
        talentId: string,
        query: TalentContactLogQueryDto,
        userId: string,
        roles: string[],
    ) {
        await this.getTalent(talentId, userId, roles);
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 20;
        const skip = (page - 1) * pageSize;
        const where = { talentId };

        const [list, total] = await Promise.all([
            this.prisma.talentContactLog.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { createdAt: 'desc' },
                include: { creator: { select: MANAGER_SELECT },
                },
            }),
            this.prisma.talentContactLog.count({ where }),
        ]);

        return {
            list,
            pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize),
            },
        };
    }

    // ========== 转交 ==========

    async transfer(
        dto: CreateTalentTransferDto,
        userId: string,
        roles: string[],
    ) {
        const toUser = await this.prisma.user.findFirst({
            where: { id: dto.toUserId, deletedAt: null },
        });
        if (!toUser) {
            throw new NotFoundException('目标负责人不存在');
        }

        for (const talentId of dto.talentIds) {
            const talent = await this.getTalent(
                talentId, userId, roles,
            );
            if (talent.managerId === dto.toUserId) continue;

            await this.prisma.$transaction([
                this.prisma.talentTransfer.create({
                    data: {
                        talentId,
                        fromUserId: talent.managerId,
                        toUserId: dto.toUserId,
                        remark: dto.remark,
                        createdBy: userId,
                    },
                }),
                this.prisma.talent.update({
                    where: { id: talentId },
                    data: {
                        managerId: dto.toUserId,
                        updatedBy: userId,
                    },
                }),
            ]);
        }

        this.logger.log(
            `达人转交成功: ${dto.talentIds.length} 个 -> ${toUser.username}`,
        );
    }

    // ========== 标旗 ==========

    async setFlag(
        talentId: string,
        dto: SetTalentFlagDto,
        userId: string,
        roles: string[],
    ) {
        await this.getTalent(talentId, userId, roles);
        return this.prisma.talentFlag.upsert({
            where: {
                talentId_userId: { talentId, userId },
            },
            create: {
                talentId,
                userId,
                flagColor: dto.flagColor,
            },
            update: { flagColor: dto.flagColor },
        });
    }

    async removeFlag(
        talentId: string,
        userId: string,
        roles: string[],
    ) {
        await this.getTalent(talentId, userId, roles);
        await this.prisma.talentFlag.deleteMany({
            where: { talentId, userId },
        });
    }

    async getFlagConfigs(userId: string) {
        return this.prisma.talentFlagConfig.findMany({
            where: { userId },
            orderBy: { flagColor: 'asc' },
        });
    }

    async saveFlagConfigs(
        dto: SaveFlagConfigsDto,
        userId: string,
    ) {
        await this.prisma.$transaction(async (tx) => {
            await tx.talentFlagConfig.deleteMany({
                where: { userId },
            });
            if (dto.configs.length > 0) {
                await tx.talentFlagConfig.createMany({
                    data: dto.configs.map((c) => ({
                        userId,
                        flagColor: c.flagColor,
                        meaning: c.meaning,
                    })),
                });
            }
        });
        return this.getFlagConfigs(userId);
    }

    private mapTalent(t: any) {
        const { talentPlatforms, talentFlags, ...rest } = t;
        return {
            ...rest,
            platforms: talentPlatforms || [],
            flags: talentFlags || [],
        };
    }
}
