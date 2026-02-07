import { GroupOrderSheet, GroupOrderSheetRef } from '@/components/media/GroupOrderSheet';
import { ItemGridScreen } from '@/components/media/ItemGridScreen';
import { useGroupOrder } from '@/lib/contexts/GroupOrderContext'; // 引入 Context
import { useInfiniteQueryWithFocus } from '@/hooks/useInfiniteQueryWithFocus';
import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { useMediaFilters } from '@/hooks/useMediaFilters';
import { useSettingsColors } from '@/hooks/useSettingsColors';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { MediaItem } from '@/services/media/types';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from 'expo-router';
import { useEffect, useRef } from 'react';
import { TouchableOpacity } from 'react-native';

export default function FavoritesScreen() {
  const { currentServer } = useMediaServers();
  const mediaAdapter = useMediaAdapter();
  const navigation = useNavigation();
  const { textColor } = useSettingsColors();
  const { order } = useGroupOrder(); // 使用全局状态
  
  const sortSheetRef = useRef<GroupOrderSheetRef>(null);

  const PAGE_SIZE = 40;

  const { filters, setFilters } = useMediaFilters();

  const query = useInfiniteQueryWithFocus({
    refetchOnScreenFocus: true,
    enabled: !!currentServer,
    queryKey: ['favorites', currentServer?.id, filters], // 确保 filters 变化触发重刷
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      if (!currentServer) return { items: [], total: 0 };
      const res = await mediaAdapter.getFavoriteItemsPaged({
        userId: currentServer.userId,
        startIndex: pageParam,
        limit: PAGE_SIZE,
        includeItemTypes: filters.includeItemTypes ?? [],
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        onlyUnplayed: filters.onlyUnplayed,
        year: filters.year,
        tags: filters.tags,
      });
      const items = res.data?.Items ?? [];
      const total = res.data?.TotalRecordCount ?? items.length;
      return { items, total };
    },
    getNextPageParam: (
      lastPage: { items: MediaItem[]; total: number },
      allPages: { items: MediaItem[]; total: number }[],
    ) => {
      const loaded = allPages.reduce((sum, p) => sum + p.items.length, 0);
      return loaded >= lastPage.total || lastPage.items.length === 0 ? undefined : loaded;
    },
  });

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => sortSheetRef.current?.present()}
          style={{ paddingHorizontal: 16 }}
        >
          <Ionicons name="list" size={24} color={textColor} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, textColor]);

  return (
    <>
      <ItemGridScreen
        title="我的收藏"
        query={query}
        type="series"
        filters={filters}
        onChangeFilters={setFilters}
        groupOrder={order} // 传递即时顺序
      />
      <GroupOrderSheet ref={sortSheetRef} />
    </>
  );
}