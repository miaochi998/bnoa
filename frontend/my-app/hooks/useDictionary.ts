'use client'

import { getApiBaseUrl } from '@/lib/config';

import { useState, useEffect, useCallback, useRef } from 'react';

const API_BASE_URL =
    getApiBaseUrl();

export interface DictItem {
    id: string;
    typeCode: string;
    typeName: string;
    itemCode: string;
    itemName: string;
    itemValue: string;
    sortOrder: number;
    isDefault: boolean;
    isActive: boolean;
    color: string | null;
    icon: string | null;
    description: string | null;
}

type DictCache = Record<string, DictItem[]>;

// 全局缓存，跨组件共享
const globalCache: DictCache = {};
const pendingRequests: Record<string, Promise<DictItem[]>> = {};

async function fetchDictBatch(
    typeCodes: string[],
): Promise<DictCache> {
    const codes = typeCodes.join(',');
    const res = await fetch(
        `${API_BASE_URL}/dictionaries/batch?typeCodes=${codes}`,
    );
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    return json.data as DictCache;
}

/**
 * 获取字典数据 Hook
 * @param typeCodes 字典类型编码，可传单个字符串或数组
 */
export function useDictionary(
    typeCodes: string | string[],
) {
    const codes = Array.isArray(typeCodes)
        ? typeCodes
        : [typeCodes];
    const [data, setData] = useState<DictCache>({});
    const [loading, setLoading] = useState(true);
    const codesRef = useRef(codes.join(','));

    useEffect(() => {
        const key = codes.join(',');
        if (key !== codesRef.current) {
            codesRef.current = key;
        }

        let cancelled = false;
        const load = async () => {
            // 检查哪些 code 还没缓存
            const missing = codes.filter(
                (c) => !globalCache[c],
            );

            if (missing.length > 0) {
                // 合并去重请求
                const batchKey = missing.sort().join(',');
                if (!pendingRequests[batchKey]) {
                    pendingRequests[batchKey] = fetchDictBatch(
                        missing,
                    ).then((result) => {
                        for (const [k, v] of Object.entries(
                            result,
                        )) {
                            globalCache[k] = v;
                        }
                        delete pendingRequests[batchKey];
                        return [];
                    });
                }
                await pendingRequests[batchKey];
            }

            if (!cancelled) {
                const result: DictCache = {};
                for (const c of codes) {
                    result[c] = globalCache[c] || [];
                }
                setData(result);
                setLoading(false);
            }
        };

        load();
        return () => {
            cancelled = true;
        };
    }, [codesRef.current]);

    /** 根据 itemCode 查找条目 */
    const getItem = useCallback(
        (typeCode: string, itemCode: string) => {
            const items = data[typeCode] || [];
            return items.find(
                (i) => i.itemCode === itemCode,
            );
        },
        [data],
    );

    /** 获取 label */
    const getLabel = useCallback(
        (typeCode: string, itemCode: string) => {
            return (
                getItem(typeCode, itemCode)?.itemName ||
                itemCode
            );
        },
        [getItem],
    );

    /** 获取 color */
    const getColor = useCallback(
        (typeCode: string, itemCode: string) => {
            return (
                getItem(typeCode, itemCode)?.color || null
            );
        },
        [getItem],
    );

    /** 清除指定类型的缓存 */
    const invalidate = useCallback(
        (...typesToClear: string[]) => {
            for (const t of typesToClear) {
                delete globalCache[t];
            }
        },
        [],
    );

    return {
        data,
        loading,
        getItem,
        getLabel,
        getColor,
        invalidate,
    };
}
