import { ItemGridScreen } from '@/components/media/ItemGridScreen';
import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { useMediaFilters } from '@/hooks/useMediaFilters';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { MediaItem, MediaItemType } from '@/services/media/types';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';

export default function FolderScreen() {
  const { id, name, itemTypes } = useLocalSearchParams<{
    id: string;
    name?: string;
    itemTypes?: MediaItemType;
  }>();

  const { currentServer } = useMediaServers();
  const mediaAdapter = useMediaAdapter();

  const PAGE_SIZE = 60;

  const { filters, setFilters } = useMediaFilters({
    includeItemTypes: itemTypes ? [itemTypes] : undefined,
  });

  const query = useInfiniteQuery({
    enabled: !!currentServer && !!id,
    // 关键：filters 必须包含在 key 中
    queryKey: ['folder-items', currentServer?.id, id, filters], 
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      if (!currentServer || !id) return { items: [], total: 0 };
      const response = await mediaAdapter.getAllItemsByFolder({
        userId: currentServer.userId,
        folderId: id,
        startIndex: pageParam,
        limit: PAGE_SIZE,
        itemTypes: filters.includeItemTypes ?? [],
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        onlyUnplayed: filters.onlyUnplayed,
        year: filters.year,
        tags: filters.tags,
      });
      const items = response.data.Items || [];
      const total = response.data.TotalRecordCount ?? items.length;
      return { items: items, total };
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
      title={name || '全部内容'}
      query={query}
      type="series"
      filters={filters}
      onChangeFilters={setFilters}
    />
  );
}