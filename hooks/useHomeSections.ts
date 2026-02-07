import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { useQueryWithFocus } from '@/hooks/useQueryWithFocus';
import { getHiddenUserViews } from '@/lib/utils/userViewConfig';
import { MediaItem, MediaServerInfo } from '@/services/media/types';
import { useQueries } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

export type HomeSection = {
  key: string;
  title: string;
  items: MediaItem[];
  type?: 'latest' | 'nextup' | 'resume' | 'userview';
};

export type HomeSectionWithStatus = HomeSection & { isLoading: boolean };

export function useHomeSections(currentServer: MediaServerInfo | null) {
  const mediaAdapter = useMediaAdapter();
  const enabled = !!currentServer?.id && !!currentServer?.userId;

  const [hiddenUserViewIds, setHiddenUserViewIds] = useState<string[]>(() =>
    currentServer?.id ? getHiddenUserViews(currentServer.id) : [],
  );

  useFocusEffect(
    useCallback(() => {
      if (currentServer?.id) {
        setHiddenUserViewIds(getHiddenUserViews(currentServer.id));
      }
    }, [currentServer?.id]),
  );

  const resumeQuery = useQueryWithFocus<MediaItem[]>({
    refetchOnScreenFocus: true,
    queryKey: ['homeSections', currentServer?.id, 'resume'],
    queryFn: async () => {
      if (!currentServer) return [];
      const response = await mediaAdapter.getResumeItems({
        userId: currentServer.userId,
        limit: 10,
      });
      return response.data.Items || [];
    },
    enabled,
  });

  const nextUpQuery = useQueryWithFocus<MediaItem[]>({
    refetchOnScreenFocus: true,
    queryKey: ['homeSections', currentServer?.id, 'nextup'],
    queryFn: async () => {
      if (!currentServer) return [];
      const response = await mediaAdapter.getNextUpItems({
        userId: currentServer.userId,
        limit: 10,
      });
      return response.data.Items || [];
    },
    enabled,
  });

  const allUserViewQuery = useQueryWithFocus<MediaItem[]>({
    refetchOnScreenFocus: true,
    queryKey: ['homeSections', currentServer?.id, 'allUserView'],
    queryFn: async () => {
      if (!currentServer) return [];
      const userView = await mediaAdapter.getUserView({ userId: currentServer.userId });
      return (userView || []).filter((item) => item.collectionType !== 'playlists');
    },
    enabled,
  });

  const userViewQuery = useMemo(() => {
    if (!allUserViewQuery.data) return { ...allUserViewQuery, data: [] };
    return {
      ...allUserViewQuery,
      data: allUserViewQuery.data.filter((item) => item.id && !hiddenUserViewIds.includes(item.id)),
    };
  }, [allUserViewQuery, hiddenUserViewIds]);

  const latestFolders = useMemo(() => {
    if (!userViewQuery.data) return [];

    return userViewQuery.data
      .filter((item): item is MediaItem & { id: string } => !!item.id)
      .filter((item) => !hiddenUserViewIds.includes(item.id))
      .map((item) => ({
        folderId: item.id!,
        name: item.name || '',
      }));
  }, [userViewQuery.data, hiddenUserViewIds]);

  const latestQueries = useQueries({
    queries: latestFolders.map((folder) => ({
      queryKey: ['homeSections', currentServer?.id, 'latest', folder.folderId],
      queryFn: async () => {
        if (!currentServer) return [];
        const response = await mediaAdapter.getLatestItemsByFolder({
          userId: currentServer.userId,
          folderId: folder.folderId,
          limit: 16,
        });
        return response.data.Items || [];
      },
      enabled,
    })),
  });

  const randomItemsQuery = useQueryWithFocus<MediaItem[]>({
    refetchOnScreenFocus: false,
    queryKey: ['homeSections', currentServer?.id, 'random'],
    queryFn: async () => {
      if (!currentServer) return [];
      return await mediaAdapter.getRandomItems({
        userId: currentServer.userId,
        limit: 6,
      });
    },
    enabled,
  });

  const resumeSection = useMemo<HomeSectionWithStatus>(
    () => ({
      key: 'resume',
      title: '继续观看',
      items: resumeQuery.data ?? [],
      type: 'resume',
      isLoading: resumeQuery.isPending,
    }),
    [resumeQuery.data, resumeQuery.isPending],
  );

  const nextUpSection = useMemo<HomeSectionWithStatus>(
    () => ({
      key: 'nextup',
      title: '接下来',
      items: nextUpQuery.data ?? [],
      type: 'nextup',
      isLoading: nextUpQuery.isPending,
    }),
    [nextUpQuery.data, nextUpQuery.isPending],
  );

  const userViewSection = useMemo<HomeSectionWithStatus>(
    () => ({
      key: 'userview',
      title: '媒体库',
      items: userViewQuery.data ?? [],
      type: 'userview',
      isLoading: userViewQuery.isPending,
    }),
    [userViewQuery.data, userViewQuery.isPending],
  );

  const latestSections = useMemo<HomeSectionWithStatus[]>(
    () =>
      latestFolders.map((folder, index) => {
        const query = latestQueries[index];
        const items = query?.data ?? [];

        // 修复：移除 "最近添加的" 前缀，直接使用文件夹名称
        return {
          key: `latest_${folder.folderId}`,
          title: folder.name, 
          items,
          type: 'latest',
          isLoading: query?.isPending ?? false,
        } satisfies HomeSectionWithStatus;
      }),
    [latestFolders, latestQueries],
  );

  const sections = useMemo<HomeSectionWithStatus[]>(
    () => [resumeSection, nextUpSection, userViewSection, ...latestSections],
    [resumeSection, nextUpSection, userViewSection, latestSections],
  );

  return {
    sections,
    resume: resumeSection,
    nextUp: nextUpSection,
    userView: userViewSection,
    latest: latestSections,
    randomItemsQuery,
  };
}