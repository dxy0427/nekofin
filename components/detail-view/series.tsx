import { useThemeColor } from '@/hooks/useThemeColor';
import { MediaItem, MediaPerson } from '@/services/media/types';
import { FlatList, Text, View } from 'react-native';

import { EpisodeCard, SeriesCard } from '../media/Card';
import { detailViewStyles, ItemInfoList, ItemMeta, ItemOverview, PlayButton } from './common';
import { PersonItem } from './PersonItem';

export const SeriesModeContent = ({
  seasons,
  nextUpItems,
  people,
  similarItems,
  item,
}: {
  seasons: MediaItem[];
  nextUpItems: MediaItem[];
  people: MediaPerson[];
  similarItems: MediaItem[];
  item: MediaItem;
}) => {
  const textColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text');

  // 获取下一个播放的剧集（通常是 nextUpItems 的第一个）
  const resumeEpisode = nextUpItems.length > 0 ? nextUpItems[0] : null;

  return (
    <>
      <ItemMeta item={item} />

      {/* 如果有待播放的剧集，显示一个大的播放按钮 */}
      {resumeEpisode && (
        <View style={{ marginTop: 8 }}>
          <PlayButton item={resumeEpisode} />
          <Text
            style={{
              color: textColor,
              opacity: 0.6,
              fontSize: 12,
              marginTop: 4,
              textAlign: 'center',
            }}
          >
            {resumeEpisode.seasonId
              ? `继续观看 S${resumeEpisode.parentIndexNumber}E${resumeEpisode.indexNumber}`
              : '继续观看'}
          </Text>
        </View>
      )}

      <ItemOverview item={item} />
      <ItemInfoList item={item} />

      {nextUpItems.length > 0 && (
        <View style={detailViewStyles.sectionBlock}>
          <Text style={[detailViewStyles.sectionTitle, { color: textColor }]}>接下来</Text>
          <FlatList
            horizontal
            data={nextUpItems}
            style={detailViewStyles.edgeToEdge}
            renderItem={({ item }) => (
              <EpisodeCard item={item} style={detailViewStyles.horizontalCard} imgType="Primary" />
            )}
            keyExtractor={(item) => item.id!}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={detailViewStyles.horizontalList}
          />
        </View>
      )}

      {seasons && seasons.length > 0 && (
        <View style={detailViewStyles.sectionBlock}>
          <Text style={[detailViewStyles.sectionTitle, { color: textColor }]}>季度</Text>
          <FlatList
            horizontal
            data={seasons}
            style={detailViewStyles.edgeToEdge}
            renderItem={({ item }) => <SeriesCard item={item} imgType="Primary" hideSubtitle />}
            keyExtractor={(item) => item.id!}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={detailViewStyles.horizontalList}
          />
        </View>
      )}

      {people && people.length > 0 && (
        <View style={detailViewStyles.sectionBlock}>
          <Text style={[detailViewStyles.sectionTitle, { color: textColor }]}>演职人员</Text>
          <FlatList
            horizontal
            data={people}
            style={detailViewStyles.edgeToEdge}
            renderItem={({ item }) => <PersonItem item={item} />}
            keyExtractor={(item) => `${item.id ?? item.name}-${item.type ?? ''}`}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={detailViewStyles.horizontalList}
          />
        </View>
      )}

      {similarItems && similarItems.length > 0 && (
        <View style={detailViewStyles.sectionBlock}>
          <Text style={[detailViewStyles.sectionTitle, { color: textColor }]}>更多类似的</Text>
          <FlatList
            horizontal
            data={similarItems}
            style={detailViewStyles.edgeToEdge}
            renderItem={({ item }) => <SeriesCard item={item} imgType="Primary" />}
            keyExtractor={(item) => item.id!}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={detailViewStyles.horizontalList}
          />
        </View>
      )}
    </>
  );
};