// ImageLocalizer/ImageLocalizeQueue.ts
import { getApiBaseUrl } from '@/lib/config';
import { Editor } from '@tiptap/react';
import {
    LocalizeConfig,
    LocalizeTask,
    DEFAULT_LOCALIZE_CONFIG,
} from './types';

const API_BASE_URL =
    getApiBaseUrl();

export class ImageLocalizeQueue {
    private editor: Editor;
    private config: LocalizeConfig;
    private tasks: LocalizeTask[] = [];
    private listeners: (() => void)[] = [];
    private processing = false;

    constructor(
        editor: Editor,
        config?: Partial<LocalizeConfig>,
    ) {
        this.editor = editor;
        this.config = {
            ...DEFAULT_LOCALIZE_CONFIG,
            ...config,
        };
    }

    subscribe(listener: () => void): () => void {
        this.listeners.push(listener);
        return () => {
            this.listeners =
                this.listeners.filter(
                    (l) => l !== listener
                );
        };
    }

    private notify() {
        this.listeners.forEach((l) => l());
    }

    getTasks(): LocalizeTask[] {
        return [...this.tasks];
    }

    getStats() {
        const total = this.tasks.length;
        const success = this.tasks.filter(
            (t) => t.status === 'success'
        ).length;
        const error = this.tasks.filter(
            (t) => t.status === 'error'
        ).length;
        const pending = this.tasks.filter(
            (t) =>
                t.status === 'pending'
                || t.status === 'downloading'
                || t.status === 'uploading'
        ).length;
        return { total, success, error, pending };
    }

    /**
     * 扫描编辑器中的远程图片
     */
    findRemoteImages(): string[] {
        const urls: string[] = [];
        this.editor.state.doc.descendants(
            (node) => {
                if (
                    node.type.name === 'image'
                    && node.attrs.src
                ) {
                    const src = node.attrs.src;
                    if (
                        src.startsWith('http')
                        && !src.includes(
                            'localhost'
                        )
                    ) {
                        urls.push(src);
                    }
                }
            }
        );
        return [...new Set(urls)];
    }

    /**
     * 添加本地化任务
     */
    addTasks(urls: string[]) {
        for (const url of urls) {
            const exists = this.tasks.some(
                (t) => t.originalUrl === url
            );
            if (!exists) {
                this.tasks.push({
                    id: crypto.randomUUID(),
                    originalUrl: url,
                    status: 'pending',
                    progress: 0,
                    retryCount: 0,
                });
            }
        }
        this.notify();
        this.processQueue();
    }

    /**
     * 处理队列
     */
    private async processQueue() {
        if (this.processing) return;
        this.processing = true;

        while (true) {
            const pending = this.tasks.filter(
                (t) => t.status === 'pending'
            );
            if (pending.length === 0) break;

            const batch = pending.slice(
                0, this.config.concurrentLimit
            );
            await Promise.allSettled(
                batch.map((task) =>
                    this.processTask(task)
                )
            );
        }

        this.processing = false;
    }

    private async processTask(
        task: LocalizeTask
    ) {
        task.status = 'downloading';
        task.progress = 20;
        this.notify();

        try {
            const token =
                localStorage.getItem('accessToken');
            const res = await fetch(
                `${API_BASE_URL}/upload`
                + `/localize-image`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type':
                            'application/json',
                        ...(token
                            ? {
                                Authorization:
                                    `Bearer ${token}`,
                            }
                            : {}),
                    },
                    body: JSON.stringify({
                        url: task.originalUrl,
                        convertToWebp:
                            this.config.convertToWebp,
                        quality:
                            this.config.webpQuality,
                        storage:
                            this.config.storage,
                        folderId:
                            this.config.folderId,
                    }),
                }
            );

            task.progress = 80;
            task.status = 'uploading';
            this.notify();

            const data = await res.json();
            if (data.data?.url) {
                task.localUrl = data.data.url;
                task.status = 'success';
                task.progress = 100;

                // 替换编辑器中的图片 URL
                this.replaceImageUrl(
                    task.originalUrl,
                    data.data.url
                );
            } else {
                throw new Error(
                    data.message || '本地化失败'
                );
            }
        } catch (err: any) {
            if (
                task.retryCount
                < this.config.retryCount
            ) {
                task.retryCount++;
                task.status = 'pending';
                task.progress = 0;
            } else {
                task.status = 'error';
                task.error = err.message;
            }
        }

        this.notify();
    }

    private replaceImageUrl(
        oldUrl: string,
        newUrl: string
    ) {
        const { doc, tr } =
            this.editor.state;
        let modified = false;
        doc.descendants((node, pos) => {
            if (
                node.type.name === 'image'
                && node.attrs.src === oldUrl
            ) {
                tr.setNodeMarkup(pos, undefined, {
                    ...node.attrs,
                    src: newUrl,
                });
                modified = true;
            }
        });
        if (modified) {
            this.editor.view.dispatch(tr);
        }
    }

    clearCompletedTasks() {
        this.tasks = this.tasks.filter(
            (t) =>
                t.status !== 'success'
                && t.status !== 'error'
        );
        this.notify();
    }

    removeTask(taskId: string) {
        this.tasks = this.tasks.filter(
            (t) => t.id !== taskId
        );
        this.notify();
    }

    updateConfig(
        config: Partial<LocalizeConfig>
    ) {
        this.config = {
            ...this.config,
            ...config,
        };
    }

    destroy() {
        this.listeners = [];
        this.tasks = [];
    }
}
