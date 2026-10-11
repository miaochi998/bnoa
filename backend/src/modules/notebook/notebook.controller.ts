import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    HttpCode,
    HttpStatus,
    ForbiddenException,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiBearerAuth,
    ApiQuery,
} from '@nestjs/swagger';
import { NotebookService } from './notebook.service';
import { CreateNotebookDto } from './dto/create-notebook.dto';
import { UpdateNotebookDto } from './dto/update-notebook.dto';
import { NotebookFilterDto } from './dto/notebook-filter.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import {
    CurrentUser,
    UserPayload,
} from '../../common/decorators/current-user.decorator';
import {
    FieldKeyMapping,
    FieldPermissionService,
    FieldPermissionState,
} from '../role/field-permission.service';

/**
 * 记事本字段映射：用于「信息权限」的读取脱敏与写入过滤
 * 说明：记事本内容是个人信息，超管可在列表里看到全部人的笔记，
 *      此时「内容」字段权限才有实际意义（普通用户本来就只能看自己的）。
 */
const NOTEBOOK_FIELD_MAP: FieldKeyMapping[] = [
    { field: 'title', key: 'title' },
    { field: 'content', key: 'content' },
    { field: 'userId', key: 'userId' },
    { field: 'userId', key: 'user' },
];

/** 需要递归处理的数组字段名 */
const NOTEBOOK_NESTED_ARRAYS = ['list', 'data', 'items'];

@ApiTags('记事本管理')
@Controller('notebooks')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class NotebookController {
    constructor(
        private readonly notebookService: NotebookService,
        private readonly fieldPermissionService: FieldPermissionService,
    ) {}

    /** 当前用户在本模块的字段权限 */
    private resolveFields(user: UserPayload) {
        return this.fieldPermissionService.resolve(
            user.sub,
            'notebook',
            user.roles ?? [],
        );
    }

    /** 记事本（含关联数组）的读脱敏 */
    private stripNotebookDeep(node: any, state: FieldPermissionState): any {
      return this.fieldPermissionService.stripHiddenFieldsDeep(
        node,
        NOTEBOOK_FIELD_MAP,
        state,
      );
    }

    @Get()
    @Permissions('notebook:view')
    @ApiOperation({ summary: '获取记事本列表' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'pageSize', required: false, type: Number })
    @ApiQuery({ name: 'keyword', required: false, type: String })
    @ApiQuery({ name: 'userId', required: false, type: String })
    async findAll(
        @CurrentUser() user: UserPayload,
        @Query() filter: NotebookFilterDto,
    ) {
        const isSuperAdmin = user.roles?.includes('super_admin') || false;
        const result = await this.notebookService.findAll(user.sub, isSuperAdmin, filter);
        const state = await this.resolveFields(user);
        return {
            ...result,
            list: (result.list || []).map((n: any) =>
                this.stripNotebookDeep(n, state),
            ),
        };
    }

    @Get(':id')
    @Permissions('notebook:view')
    @ApiOperation({ summary: '获取记事本详情' })
    async findById(
        @CurrentUser() user: UserPayload,
        @Param('id') id: string,
    ) {
        const isSuperAdmin = user.roles?.includes('super_admin') || false;
        const notebook = await this.notebookService.findById(id, user.sub, isSuperAdmin);
        const state = await this.resolveFields(user);
        return this.stripNotebookDeep(notebook, state);
    }

    @Post()
    @Permissions('notebook:create')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: '创建记事本' })
    async create(
        @CurrentUser() user: UserPayload,
        @Body() data: CreateNotebookDto,
    ) {
        const state = await this.resolveFields(user);
        const safe = this.fieldPermissionService.stripUneditableFields(
            data as any,
            NOTEBOOK_FIELD_MAP,
            state,
        );
        if (!safe.title) {
            throw new ForbiddenException('没有「记事本标题」的编辑权限');
        }
        const notebook = await this.notebookService.create(user.sub, safe as CreateNotebookDto);
        return {
            success: true,
            message: '记事本创建成功',
            data: this.stripNotebookDeep(notebook, state),
        };
    }

    @Patch(':id')
    @Permissions('notebook:edit')
    @ApiOperation({ summary: '更新记事本' })
    async update(
        @CurrentUser() user: UserPayload,
        @Param('id') id: string,
        @Body() data: UpdateNotebookDto,
    ) {
        const isSuperAdmin = user.roles?.includes('super_admin') || false;
        const state = await this.resolveFields(user);
        const safe = this.fieldPermissionService.stripUneditableFields(
            data as any,
            NOTEBOOK_FIELD_MAP,
            state,
        );
        if (Object.keys(safe).length === 0) {
            throw new ForbiddenException('没有记事本字段的编辑权限');
        }
        const notebook = await this.notebookService.update(
            id,
            user.sub,
            isSuperAdmin,
            safe as UpdateNotebookDto,
        );
        return {
            success: true,
            message: '记事本更新成功',
            data: this.stripNotebookDeep(notebook, state),
        };
    }

    @Delete(':id')
    @Permissions('notebook:delete')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: '删除记事本' })
    async delete(
        @CurrentUser() user: UserPayload,
        @Param('id') id: string,
    ) {
        const isSuperAdmin = user.roles?.includes('super_admin') || false;
        await this.notebookService.delete(id, user.sub, isSuperAdmin);
    }
}
