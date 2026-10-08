/**
 * 定时任务状态信息
 */
export interface SchedulerInfo {
    name: string;
    enabled: boolean;
    cron: string;
    description: string;
    lastRunAt?: Date;
    nextRunAt?: Date;
}

/**
 * 队列状态信息
 */
export interface QueueInfo {
    name: string;
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
}

/**
 * 任务执行结果
 */
export interface TaskResult {
    success: boolean;
    message: string;
    affectedCount?: number;
}
