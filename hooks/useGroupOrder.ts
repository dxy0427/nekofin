import { storage } from '@/lib/storage';
import { useCallback, useState } from 'react';

const STORAGE_KEY = 'favorites_group_order';

// 默认顺序：电影 -> 剧集 -> 合集 -> 季度 -> 单集 -> 其他
export const DEFAULT_ORDER = [
  'Movie',
  'Series',
  'BoxSet',
  'Season',
  'Episode',
  'MusicVideo',
  'Other',
];

export function useGroupOrder() {
  const [order, setOrder] = useState<string[]>(() => {
    const saved = storage.getString(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // 简单的合并策略：确保新类型也被包含，旧类型被保留
        const merged = Array.from(new Set([...parsed, ...DEFAULT_ORDER]));
        return merged;
      } catch (e) {
        return DEFAULT_ORDER;
      }
    }
    return DEFAULT_ORDER;
  });

  const updateOrder = useCallback((newOrder: string[]) => {
    setOrder(newOrder);
    storage.set(STORAGE_KEY, JSON.stringify(newOrder));
  }, []);

  const resetOrder = useCallback(() => {
    setOrder(DEFAULT_ORDER);
    storage.delete(STORAGE_KEY);
  }, []);

  return {
    order,
    updateOrder,
    resetOrder,
  };
}