import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class EmailTemplateService implements OnModuleInit {
    private readonly logger = new Logger(EmailTemplateService.name);
    private readonly templates = new Map<
        string,
        HandlebarsTemplateDelegate
    >();
    private baseLayout: HandlebarsTemplateDelegate | null = null;

    async onModuleInit(): Promise<void> {
        await this.loadTemplates();
    }

    /** 加载所有模板文件并编译 */
    private async loadTemplates(): Promise<void> {
        const templatesDir = path.join(
            __dirname, 'templates',
        );
        const layoutsDir = path.join(templatesDir, 'layouts');

        // 加载基础布局
        const basePath = path.join(layoutsDir, 'base.hbs');
        if (fs.existsSync(basePath)) {
            const baseSource = fs.readFileSync(
                basePath, 'utf-8',
            );
            this.baseLayout = Handlebars.compile(baseSource);
            Handlebars.registerPartial('base', baseSource);
        }

        // 加载所有模板
        if (fs.existsSync(templatesDir)) {
            const files = fs.readdirSync(templatesDir)
                .filter(f => f.endsWith('.hbs'));

            for (const file of files) {
                const name = path.basename(file, '.hbs');
                const source = fs.readFileSync(
                    path.join(templatesDir, file), 'utf-8',
                );
                this.templates.set(
                    name, Handlebars.compile(source),
                );
            }
        }

        this.registerHelpers();

        this.logger.log(
            `邮件模板加载完成，共 ${this.templates.size} 个`,
        );
    }

    /** 渲染指定模板 */
    async render(
        templateName: string,
        data: Record<string, any>,
    ): Promise<string> {
        const template = this.templates.get(templateName);
        if (!template) {
            throw new Error(
                `邮件模板不存在: ${templateName}`,
            );
        }

        const fullData = {
            ...data,
            appName: 'BNOA 办公系统',
            year: new Date().getFullYear(),
            timestamp: new Date().toLocaleString('zh-CN'),
        };

        const content = template(fullData);

        if (this.baseLayout) {
            return this.baseLayout({
                ...fullData,
                content,
            });
        }

        return content;
    }

    /** 获取模板源码（供前端编辑） */
    getTemplateSource(name: string): string | null {
        const templatesDir = path.join(
            __dirname, 'templates',
        );
        const filePath = path.join(
            templatesDir, `${name}.hbs`,
        );

        if (!fs.existsSync(filePath)) {
            return null;
        }

        return fs.readFileSync(filePath, 'utf-8');
    }

    /** 保存模板源码 */
    saveTemplateSource(
        name: string, content: string,
    ): void {
        const templatesDir = path.join(
            __dirname, 'templates',
        );
        const filePath = path.join(
            templatesDir, `${name}.hbs`,
        );

        fs.writeFileSync(filePath, content, 'utf-8');

        // 重新编译该模板
        this.templates.set(
            name, Handlebars.compile(content),
        );

        this.logger.log(`邮件模板已更新: ${name}`);
    }

    /** 获取所有模板名称列表 */
    getTemplateNames(): string[] {
        return Array.from(this.templates.keys());
    }

    /** 注册 Handlebars 自定义 helpers */
    private registerHelpers(): void {
        Handlebars.registerHelper(
            'formatDate',
            (date: Date) => {
                return new Date(date)
                    .toLocaleString('zh-CN');
            },
        );

        Handlebars.registerHelper(
            'eq',
            (a: any, b: any) => a === b,
        );
    }
}
