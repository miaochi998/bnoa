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

@ApiTags('记事本管理')
@Controller('notebooks')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class NotebookController {
    constructor(private readonly notebookService: NotebookService) {}

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
        return this.notebookService.findAll(user.sub, isSuperAdmin, filter);
    }

    @Get(':id')
    @Permissions('notebook:view')
    @ApiOperation({ summary: '获取记事本详情' })
    async findById(
        @CurrentUser() user: UserPayload,
        @Param('id') id: string,
    ) {
        const isSuperAdmin = user.roles?.includes('super_admin') || false;
        return this.notebookService.findById(id, user.sub, isSuperAdmin);
    }

    @Post()
    @Permissions('notebook:create')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: '创建记事本' })
    async create(
        @CurrentUser() user: UserPayload,
        @Body() data: CreateNotebookDto,
    ) {
        const notebook = await this.notebookService.create(user.sub, data);
        return {
            success: true,
            message: '记事本创建成功',
            data: notebook,
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
        const notebook = await this.notebookService.update(
            id,
            user.sub,
            isSuperAdmin,
            data,
        );
        return {
            success: true,
            message: '记事本更新成功',
            data: notebook,
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
