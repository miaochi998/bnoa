import { useEffect, useState } from 'react';

/**
 * 返回一个防抖后的值，在 value 停止变化 delay 毫秒后才更新。
 * 常用于实时搜索场景：用户输入时不会立即触发请求，停止输入后才发起。
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);

    return debouncedValue;
}
