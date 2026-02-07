import { storage } from '@/lib/storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'favorites_group_order';

// 默认顺序
export const DEFAULT_ORDER = [
  'Movie',
  'Series',
  'BoxSet',
  'Season',
  'Episode',
  'MusicVideo',
  'Other',
];

type GroupOrderContextType = {
  order: string[];
  updateOrder: (newOrder: string[]) => void;
  resetOrder: () => void;
};

const GroupOrderContext = createContext<GroupOrderContextType | undefined>(undefined);

export function GroupOrderProvider({ children }: { children: React.ReactNode }) {
  const [order, setOrder] = useState<string[]>(() => {
    const saved = storage.getString(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // 合并策略：确保新类型存在，去重
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

  return (
    <GroupOrderContext.Provider value={{ order, updateOrder, resetOrder }}>
      {children}
    </GroupOrderContext.Provider>
  );
}

export function useGroupOrder() {
  const context = useContext(GroupOrderContext);
  if (!context) {
    throw new Error('useGroupOrder must be used within a GroupOrderProvider');
  }
  return context;
}