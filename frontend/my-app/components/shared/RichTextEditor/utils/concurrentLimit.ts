// utils/concurrentLimit.ts

/**
 * 并发控制 - 限制同时执行的异步任务数量
 */
export async function concurrentLimit<T>(
    tasks: (() => Promise<T>)[],
    limit: number
): Promise<T[]> {
    const results: T[] = [];
    const executing: Promise<void>[] = [];

    for (const task of tasks) {
        const p = task().then((result) => {
            results.push(result);
        });
        const e = p.then(() => {
            executing.splice(
                executing.indexOf(e), 1
            );
        });
        executing.push(e);

        if (executing.length >= limit) {
            await Promise.race(executing);
        }
    }

    await Promise.all(executing);
    return results;
}
