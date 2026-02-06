import { storage } from '@/lib/storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { TextStyle } from 'react-native';
import uuid from 'react-native-uuid';

export type DanmakuSource = {
  id: string;
  name: string;
  url: string;
};

export type DanmakuSettingsType = {
  opacity: number;
  speed: number;
  fontSize: number;
  heightRatio: number;
  danmakuFilter: number;
  danmakuModeFilter: number;
  danmakuDensityLimit: number;
  curEpOffset: number;
  fontFamily: string;
  fontWeight: TextStyle['fontWeight'];
  // 新增：源列表和当前选中的源ID
  sources: DanmakuSource[];
  activeSourceId: string;
};

type DanmakuSettingsContextValue = {
  settings: DanmakuSettingsType;
  setSettings: (next: DanmakuSettingsType) => void;
  // 辅助操作方法
  addSource: (name: string, url: string) => void;
  updateSource: (id: string, name: string, url: string) => void;
  removeSource: (id: string) => void;
  setActiveSource: (id: string) => void;
  getActiveSource: () => DanmakuSource | undefined;
};

// 默认设置，初始源列表为空，或者你可以保留一个示例
export const defaultSettings: DanmakuSettingsType = {
  opacity: 0.8,
  speed: 140,
  fontSize: 20,
  heightRatio: 0.9,
  danmakuFilter: 0,
  danmakuModeFilter: 0,
  danmakuDensityLimit: 0,
  curEpOffset: 0,
  fontFamily: '"Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif',
  fontWeight: '700',
  sources: [], 
  activeSourceId: '',
};

const DanmakuSettingsContext = createContext<DanmakuSettingsContextValue | null>(null);

export function DanmakuSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<DanmakuSettingsType>(() => {
    const savedSettings = storage.getString('danmakuSettings');
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      // 迁移旧数据：如果旧数据没有 sources 字段，给予默认值
      if (!parsed.sources) {
        return {
          ...parsed,
          sources: [],
          activeSourceId: '',
        };
      }
      return parsed;
    }
    return defaultSettings;
  });

  // 监听设置变化并持久化
  useEffect(() => {
    storage.set('danmakuSettings', JSON.stringify(settings));
  }, [settings]);

  const addSource = (name: string, url: string) => {
    const id = uuid.v4() as string;
    const cleanUrl = url.replace(/\/$/, ''); // 去除末尾斜杠
    
    setSettings((prev) => {
      const newSource = { id, name, url: cleanUrl };
      // 如果是第一个添加的源，自动设为选中
      const newActiveId = prev.sources.length === 0 ? id : prev.activeSourceId;
      
      return {
        ...prev,
        sources: [...prev.sources, newSource],
        activeSourceId: newActiveId,
      };
    });
  };

  const updateSource = (id: string, name: string, url: string) => {
    const cleanUrl = url.replace(/\/$/, '');
    setSettings((prev) => ({
      ...prev,
      sources: prev.sources.map((s) => (s.id === id ? { ...s, name, url: cleanUrl } : s)),
    }));
  };

  const removeSource = (id: string) => {
    setSettings((prev) => {
      const newSources = prev.sources.filter((s) => s.id !== id);
      // 如果删除了当前选中的源，重置 activeSourceId
      let newActiveId = prev.activeSourceId;
      if (prev.activeSourceId === id) {
        newActiveId = newSources.length > 0 ? newSources[0].id : '';
      }
      return {
        ...prev,
        sources: newSources,
        activeSourceId: newActiveId,
      };
    });
  };

  const setActiveSource = (id: string) => {
    setSettings((prev) => ({ ...prev, activeSourceId: id }));
  };

  const getActiveSource = () => {
    return settings.sources.find((s) => s.id === settings.activeSourceId);
  };

  const value = useMemo(
    () => ({
      settings,
      setSettings,
      addSource,
      updateSource,
      removeSource,
      setActiveSource,
      getActiveSource,
    }),
    [settings]
  );

  return (
    <DanmakuSettingsContext.Provider value={value}>{children}</DanmakuSettingsContext.Provider>
  );
}

export function useDanmakuSettings() {
  const ctx = useContext(DanmakuSettingsContext);
  if (!ctx) {
    throw new Error('useDanmakuSettings must be used within DanmakuSettingsProvider');
  }
  return ctx;
}