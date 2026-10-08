import { Module } from '@nestjs/common';
import { NotebookController } from './notebook.controller';
import { NotebookService } from './notebook.service';
import { PrismaService } from '../../config/prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [AuthModule],
    controllers: [NotebookController],
    providers: [NotebookService, PrismaService],
    exports: [NotebookService],
})
export class NotebookModule {}
