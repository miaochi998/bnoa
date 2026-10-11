import { Module } from '@nestjs/common';
import { NotebookController } from './notebook.controller';
import { NotebookService } from './notebook.service';
import { PrismaService } from '../../config/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { RoleModule } from '../role/role.module';

@Module({
    imports: [AuthModule, RoleModule],
    controllers: [NotebookController],
    providers: [NotebookService, PrismaService],
    exports: [NotebookService],
})
export class NotebookModule {}
