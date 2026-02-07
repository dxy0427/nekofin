import { EpisodeCard, SeriesCard } from '@/components/media/Card';
import { useGridLayout } from '@/hooks/useGridLayout';
import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { MediaFilters } from '@/hooks/useMediaFilters';
import useRefresh from '@/hooks/useRefresh';
import { useSettingsColors } from '@/hooks/useSettingsColors';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { MediaItem, MediaSortBy } from '@/services/media/types';
import { InfiniteData, UseInfiniteQueryResult, useQuery } from '@tanstack/react-query';
import { useNavigation } from 'expo-router';
import React, { useCallback, useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import PageScrollView from '../PageScrollView';
import { FilterButton } from '../ui/FilterButton';
import { SkeletonItemGrid } from '../ui/Skeleton';

export type ItemGridScreenProps = {
  title: string;
  query?: UseInfiniteQueryResult<
    InfiniteData<MediaItem[] | { items: MediaItem[]; total: number }, unknown>,
    unknown
  >;
  data?: MediaItem[];
  type?: 'series' | 'episode';
  filters?: MediaFilters;
  onChangeFilters?: (next: MediaFilters) => void;
  disableGrouping?: boolean;
  groupOrder?: string[];
};

export function ItemGridScreen({
  title,
  query,
  data: dataProp,
  type,
  filters,
  onChangeFilters,
  disableGrouping = false,
  groupOrder,
}: ItemGridScreenProps) {
  const insets = useSafeAreaInsets();
  const { backgroundColor, textColor, accentColor } = useSettingsColors();
  const { numColumns, itemWidth, gap } = useGridLayout(type);
  const episodeLayout = useGridLayout('episode');

  const navigation = useNavigation();
  const { currentServer } = useMediaServers();
  const mediaAdapter = useMediaAdapter();

  const queryData = query ? query.data : undefined;
  const isLoading = query ? query.isLoading : false;
  const isError = query ? query.isError : false;
  const refetch = query ? query.refetch : undefined;
  const fetchNextPage = query ? query.fetchNextPage : undefined;
  const hasNextPage = query ? query.hasNextPage : false;
  const isFetchingNextPage = query ? query.isFetchingNextPage : false;

  const useThreeCols = type === 'series';

  const items = useMemo(() => {
    if (dataProp) {
      const merged: MediaItem[] = [];
      const seen = new Set<string | undefined>();
      for (const it of dataProp) {
        const id = it.id;
        if (id && !seen.has(id)) {
          merged.push(it);
          seen.add(id);
        }
      }
      return merged;
    }
    if (queryData) {
      const pages = queryData.pages ?? [];
      const merged: MediaItem[] = [];
      const seen = new Set<string | undefined>();
      for (const page of pages) {
        const list = Array.isArray(page) ? page : page.items;
        for (const it of list) {
          const id = it.id;
          if (id && !seen.has(id)) {
            merged.push(it);
            seen.add(id);
          }
        }
      }
      return merged;
    }
    return [];
  }, [dataProp, queryData]);

  const groupedItems = useMemo(() => {
    if (disableGrouping) {
      return [{ key: 'all', title: '', items }];
    }
    const typeToItems: Record<string, MediaItem[]> = {};
    items.forEach((item) => {
      const key = item.type || 'Other';
      if (!typeToItems[key]) typeToItems[key] = [];
      typeToItems[key].push(item);
    });

    const order = groupOrder || [
      'Movie',
      'Series',
      'BoxSet',
      'Season',
      'Episode',
      'MusicVideo',
      'Other',
    ];

    const titleMap: Record<string, string> = {
      BoxSet: '合集',
      Series: '剧集',
      Season: '季度',
      Movie: '电影',
      Episode: '单集',
      MusicVideo: '音乐视频',
      Other: '其他',
    };
    const entries = Object.entries(typeToItems);
    entries.sort(
      (a, b) =>
        (order.indexOf(a[0]) === -1 ? 999 : order.indexOf(a[0])) -
        (order.indexOf(b[0]) === -1 ? 999 : order.indexOf(b[0])),
    );
    return entries.map(([type, items]) => ({ key: type, title: titleMap[type] || type, items }));
  }, [items, disableGrouping, groupOrder]);

  const { refreshing, onRefresh } = useRefresh(refetch || (async () => {}));

  const { data: availableFilters } = useQuery({
    enabled: !!currentServer && !!onChangeFilters,
    queryKey: ['available-filters', currentServer?.id],
    queryFn: async () => {
      const res = await mediaAdapter.getAvailableFilters({ userId: currentServer!.userId });
      return res;
    },
    staleTime: 10 * 60 * 1000,
  });

  const renderItem = useCallback(
    ({ item }: { item: MediaItem }) => {
      const itemStyle = { width: itemWidth };

      if (item.type === 'Episode') {
        return <EpisodeCard item={item} style={itemStyle} />;
      }

      return useThreeCols ? (
        <SeriesCard item={item} style={itemStyle} />
      ) : (
        <EpisodeCard item={item} style={itemStyle} />
      );
    },
    [itemWidth, useThreeCols],
  );

  const keyExtractor = useCallback(
    (item: MediaItem, index: number) => item.id || `item-${index}`,
    [],
  );

  const handleEndReached = useCallback(async () => {
    if (!query || !hasNextPage || isFetchingNextPage || !fetchNextPage) return;
    await fetchNextPage();
  }, [query, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const listFooter = useMemo(() => {
    if (!query) return <View style={{ height: 16 }} />;
    if (isFetchingNextPage) {
      return (
        <View style={styles.footerLoadingContainer}>
          <ActivityIndicator size="small" color={accentColor} />
        </View>
      );
    }
    return <View style={{ height: 16 }} />;
  }, [query, isFetchingNextPage, accentColor]);

  useEffect(() => {
    navigation.setOptions({ title });
  }, [navigation, title]);

  const renderFilterBar = useCallback(() => {
    if (!onChangeFilters) return null;

    // 移除 GlassContainer 以优化性能
    return (
      <View style={styles.filterBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          <FilterButton
            label="年份"
            title="选择年份"
            options={[
              { label: '不限' },
              ...(availableFilters?.years ?? []).map((y) => ({
                label: String(y),
                value: String(y),
                active: filters?.year === y,
              })),
            ]}
            onSelect={(v) => {
              onChangeFilters({
                ...filters,
                year: v ? Number(v) : undefined,
              });
            }}
          />
          <FilterButton
            label="标签"
            title="选择标签"
            options={[
              { label: '不限' },
              ...(availableFilters?.tags ?? []).map((t) => ({
                label: t,
                value: t,
                active: !!filters?.tags?.includes(t),
              })),
            ]}
            onSelect={(v) => {
              onChangeFilters({
                ...filters,
                tags: v ? [v] : undefined,
              });
            }}
          />
          <FilterButton
            label="排序依据"
            title="选择排序依据"
            options={[
              {
                label: '名称',
                value: 'SortName',
                active: (filters?.sortBy?.[0] ?? 'SortName') === 'SortName',
              },
              {
                label: '创建日期',
                value: 'DateCreated',
                active: (filters?.sortBy?.[0] ?? '') === 'DateCreated',
              },
              {
                label: '首映日期',
                value: 'PremiereDate',
                active: (filters?.sortBy?.[0] ?? '') === 'PremiereDate',
              },
              {
                label: '评分',
                value: 'CommunityRating',
                active: (filters?.sortBy?.[0] ?? '') === 'CommunityRating',
              },
              {
                label: '播放日期',
                value: 'DatePlayed',
                active: (filters?.sortBy?.[0] ?? '') === 'DatePlayed',
              },
            ]}
            onSelect={(v) => {
              if (v) {
                onChangeFilters({
                  ...filters,
                  sortBy: [v as MediaSortBy],
                });
              }
            }}
          />
          <FilterButton
            label="排序顺序"
            title="选择排序顺序"
            options={[
              {
                label: '降序',
                value: 'Descending',
                active: (filters?.sortOrder ?? 'Descending') === 'Descending',
              },
              {
                label: '升序',
                value: 'Ascending',
                active: (filters?.sortOrder ?? 'Descending') === 'Ascending',
              },
            ]}
            onSelect={(v) => {
              if (v) {
                onChangeFilters({
                  ...filters,
                  sortOrder: v as 'Ascending' | 'Descending',
                });
              }
            }}
          />
        </ScrollView>
      </View>
    );
  }, [onChangeFilters, availableFilters, filters]);

  const renderGroupSection = useCallback(
    (group: { key: string; title: string; items: MediaItem[] }, showTitle: boolean) => {
      const isEpisodeGroup = group.key === 'Episode';
      const groupItemWidth = isEpisodeGroup ? episodeLayout.itemWidth : itemWidth;

      return (
        <View key={group.key} style={styles.groupSection}>
          {showTitle && (
            <Text style={[styles.sectionTitle, { color: textColor }]}>{group.title}</Text>
          )}
          <FlatList
            data={group.items}
            renderItem={({ item }) => {
              const itemStyle = { width: groupItemWidth };
              if (item.type === 'Episode') {
                return <EpisodeCard item={item} style={itemStyle} />;
              }
              return useThreeCols ? (
                <SeriesCard item={item} style={itemStyle} />
              ) : (
                <EpisodeCard item={item} style={itemStyle} />
              );
            }}
            keyExtractor={keyExtractor}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.horizontalList}
            contentContainerStyle={styles.horizontalListContainer}
            initialNumToRender={4}
            windowSize={3}
            ItemSeparatorComponent={() => <View style={{ width: 16 }} />}
          />
        </View>
      );
    },
    [episodeLayout.itemWidth, itemWidth, textColor, keyExtractor, useThreeCols],
  );

  if (query && isLoading) {
    return (
      <PageScrollView style={[styles.container, { backgroundColor }]}>
        <SkeletonItemGrid type={type} numColumns={numColumns} itemWidth={itemWidth} gap={gap} />
      </PageScrollView>
    );
  }

  if (query && isError) {
    return (
      <View style={[styles.container, { backgroundColor, paddingTop: insets.top }]}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: textColor }]}>加载失败，请重试</Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: accentColor }]}
            onPress={() => {
              refetch?.();
            }}
          >
            <Text style={styles.retryButtonText}>重试</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (groupedItems.length === 1) {
    return (
      <FlatList
        data={groupedItems[0].items}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        numColumns={numColumns}
        key={`${groupedItems[0].key}-${numColumns}-cols`}
        columnWrapperStyle={numColumns > 1 ? { columnGap: gap } : undefined}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
        contentContainerStyle={[
          styles.listContainer,
          { paddingBottom: 160 }, // 增加底部 padding
        ]}
        ListHeaderComponent={renderFilterBar()}
        ListFooterComponent={listFooter}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: textColor }]}>暂无内容</Text>
          </View>
        }
        style={{ backgroundColor }}
        removeClippedSubviews={true} // 性能优化
        initialNumToRender={8} // 性能优化
        maxToRenderPerBatch={8} // 性能优化
        windowSize={5} // 性能优化
      />
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor }}
      contentContainerStyle={[styles.scrollContainer, { paddingBottom: 160 }]}
      showsVerticalScrollIndicator={false}
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      removeClippedSubviews={true}
    >
      {renderFilterBar()}

      {groupedItems.length > 0 ? (
        groupedItems.map((group) => renderGroupSection(group, true))
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: textColor }]}>暂无内容</Text>
        </View>
      )}

      {listFooter}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  filterBar: {
    marginBottom: 16,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 4,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    rowGap: 16,
  },
  groupSection: {
    paddingTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  horizontalListContainer: {
    paddingLeft: 20,
    paddingRight: 20,
    paddingVertical: 12,
  },
  horizontalList: {
    marginHorizontal: -20,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.6,
  },
  footerLoadingContainer: {
    paddingVertical: 12,
    alignItems: 'center',
  },
});