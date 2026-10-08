'use client';

// ImageLocalizer/useImageLocalizer.ts
import {
    useState,
    useEffect,
    useCallback,
    useRef,
} from 'react';
import { Editor } from '@tiptap/react';
import { ImageLocalizeQueue } from './ImageLocalizeQueue';
import { LocalizeTask, LocalizeConfig } from './types';

export function useImageLocalizer(
    editor: Editor | null,
    config?: Partial<LocalizeConfig>
) {
    const [tasks, setTasks] =
        useState<LocalizeTask[]>([]);
    const [remoteImageCount, setRemoteImageCount] =
        useState(0);
    const queueRef =
        useRef<ImageLocalizeQueue | null>(null);

    useEffect(() => {
        if (!editor) return;
        const queue = new ImageLocalizeQueue(
            editor, config
        );
        queueRef.current = queue;

        const unsubscribe = queue.subscribe(() => {
            setTasks(queue.getTasks());
        });

        const updateCount = () => {
            setRemoteImageCount(
                queue.findRemoteImages().length
            );
        };
        updateCount();
        editor.on('update', updateCount);

        return () => {
            unsubscribe();
            editor.off('update', updateCount);
            queue.destroy();
        };
    }, [editor]);

    useEffect(() => {
        if (queueRef.current && config) {
            queueRef.current.updateConfig(config);
        }
    }, [config]);

    const localizeAllImages = useCallback(() => {
        if (!queueRef.current) return;
        const urls =
            queueRef.current.findRemoteImages();
        if (urls.length > 0) {
            queueRef.current.addTasks(urls);
        }
    }, []);

    const localizeImages = useCallback(
        (urls: string[]) => {
            if (!queueRef.current) return;
            queueRef.current.addTasks(urls);
        },
        []
    );

    const clearCompletedTasks = useCallback(() => {
        if (!queueRef.current) return;
        queueRef.current.clearCompletedTasks();
    }, []);

    const removeTask = useCallback(
        (taskId: string) => {
            if (!queueRef.current) return;
            queueRef.current.removeTask(taskId);
        },
        []
    );

    const updateConfig = useCallback(
        (newConfig: Partial<LocalizeConfig>) => {
            if (!queueRef.current) return;
            queueRef.current.updateConfig(newConfig);
        },
        []
    );

    const getStats = useCallback(() => {
        if (!queueRef.current) return null;
        return queueRef.current.getStats();
    }, []);

    return {
        tasks,
        remoteImageCount,
        localizeAllImages,
        localizeImages,
        clearCompletedTasks,
        removeTask,
        updateConfig,
        getStats,
    };
}
