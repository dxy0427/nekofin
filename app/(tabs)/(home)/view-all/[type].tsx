import { ItemGridScreen } from '@/components/media/ItemGridScreen';
import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { useMediaFilters } from '@/hooks/useMediaFilters';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { MediaItem } from '@/services/media/types';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';

export default function ViewAllScreen() {
  const { type, folderId, folderName } = useLocalSearchParams<{
    type: string;
    folderId?: string;
    folderName?: string;
  }>();
  const { currentServer } = useMediaServers();
  const mediaAdapter = useMediaAdapter();
  const { filters, setFilters } = useMediaFilters();

  const getTitle = () => {
    switch (type) {
      case 'resume':
        return '继续观看';
      case 'nextup':
        return '接下来';
      case 'latest':
        return folderName ? `最近添加的 ${folderName}` : '最新内容';
      default:
        return '查看所有';
    }
  };

  const getItemType = () => {
    switch (type) {
      case 'latest':
        return 'series';
      default:
        return 'episode';
    }
  };

  const PAGE_SIZE = 40;

  const query = useInfiniteQuery({
    enabled: !!currentServer,
    // 关键：filters 必须包含在 key 中
    queryKey: ['viewall', type, currentServer?.id, folderId, filters],
    initialPageParam: 0,
    queryFn: async () => {
      if (!currentServer) return { items: [], total: 0 };
      switch (type) {
        case 'resume': {
          const res = await mediaAdapter.getResumeItems({
            userId: currentServer.userId,
            limit: PAGE_SIZE,
          });
          const d = res.data;
          const items = d?.Items ?? [];
          const total = d?.TotalRecordCount ?? items.length;
          return { items, total };
        }
        case 'nextup': {
          const res = await mediaAdapter.getNextUpItems({
            userId: currentServer.userId,
            limit: PAGE_SIZE,
          });
          const d = res.data;
          const items = d?.Items ?? [];
          const total = d?.TotalRecordCount ?? items.length;
          return { items, total };
        }
        case 'latest': {
          if (folderId) {
            const res = await mediaAdapter.getLatestItemsByFolder({
              userId: currentServer.userId,
              folderId,
              limit: PAGE_SIZE,
            });
            const d = res.data;
            const items = d?.Items ?? [];
            const total = d?.TotalRecordCount ?? items.length;
            return { items, total };
          }
          const res = await mediaAdapter.getLatestItems({
            userId: currentServer.userId,
            limit: PAGE_SIZE,
            includeItemTypes: filters.includeItemTypes,
            sortBy: filters.sortBy,
            sortOrder: filters.sortOrder,
            year: filters.year,
            tags: filters.tags,
          });
          const d = res.data;
          const items = d?.Items ?? [];
          const total = d?.TotalRecordCount ?? items.length;
          return { items, total };
        }
        default:
          return { items: [], total: 0 };
      }
    },
    getNextPageParam: (
      lastPage: { items: MediaItem[]; total: number },
      allPages: { items: MediaItem[]; total: number }[],
    ) => {
      const loaded = allPages.reduce((sum, p) => sum + p.items.length, 0);
      return loaded >= lastPage.total || lastPage.items.length === 0 ? undefined : loaded;
    },
  });

  return (
    <ItemGridScreen
      title={getTitle()}
      query={query}
      type={getItemType()}
      filters={filters}
      onChangeFilters={setFilters}
    />
  );
}