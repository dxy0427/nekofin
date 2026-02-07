import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { formatBitrate } from '@/lib/utils';
import { MediaItem, MediaPerson, MediaSource } from '@/services/media/types';
import Ionicons from '@expo/vector-icons/Ionicons';
import { MenuView } from '@react-native-menu/menu';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { EpisodeCard, SeriesCard } from '../media/Card';
import { ThemedText } from '../ThemedText';
import { detailViewStyles, ItemOverview, PlayButton } from './common';
import { useDetailView } from './DetailViewContext';
import { PersonItem } from './PersonItem';

const VideoInfoCard = ({ source }: { source: MediaSource }) => {
  const textColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text');
  const subtitleColor = useThemeColor({ light: '#666', dark: '#999' }, 'text');
  const bgColor = useThemeColor({ light: '#f5f5f5', dark: '#2a2a2a' }, 'background');

  const videoStreams = source.mediaStreams.filter((s) => s.type === 'Video');
  const videoStream = videoStreams[0];

  if (!videoStream) return null;

  const resolution =
    videoStream.width && videoStream.height ? `${videoStream.width}x${videoStream.height}` : null;

  const resolutionLabel = videoStream.height
    ? videoStream.height === 1080
      ? '1080p'
      : videoStream.height === 720
        ? '720p'
        : videoStream.height === 2160
          ? '2160p'
          : videoStream.height === 1440
            ? '1440p'
            : `${videoStream.height}p`
    : null;

  const titleParts = [
    resolutionLabel,
    videoStream.codec?.toUpperCase(),
    videoStream.videoRange || 'SDR',
  ].filter(Boolean);

  const frameRate = videoStream.averageFrameRate || videoStream.realFrameRate;

  const calculateAspectRatio = (width?: number | null, height?: number | null): string | null => {
    if (!width || !height) return null;
    const ratio = width / height;
    if (Math.abs(ratio - 16 / 9) < 0.01) return '16:9';
    if (Math.abs(ratio - 4 / 3) < 0.01) return '4:3';
    if (Math.abs(ratio - 21 / 9) < 0.01) return '21:9';
    if (Math.abs(ratio - 1) < 0.01) return '1:1';
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    const divisor = gcd(width, height);
    return `${width / divisor}:${height / divisor}`;
  };

  const aspectRatio =
    videoStream.aspectRatio || calculateAspectRatio(videoStream.width, videoStream.height);

  return (
    <View style={[styles.infoCard, { backgroundColor: bgColor }]}>
      <Text style={[styles.cardTitle, { color: textColor }]}>视频</Text>
      <View style={styles.infoGrid}>
        {titleParts.length > 0 && (
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: subtitleColor }]}>标题</Text>
            <Text style={[styles.infoValue, { color: textColor }]}>{titleParts.join(' ')}</Text>
          </View>
        )}
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: subtitleColor }]}>语言</Text>
          <Text style={[styles.infoValue, { color: textColor }]}>
            {videoStream.language || 'Unknown language'}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: subtitleColor }]}>编码</Text>
          <Text style={[styles.infoValue, { color: textColor }]}>
            {videoStream.codec || '未知'}
          </Text>
        </View>
        {resolution && (
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: subtitleColor }]}>分辨率</Text>
            <Text style={[styles.infoValue, { color: textColor }]}>{resolution}</Text>
          </View>
        )}
        {frameRate && (
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: subtitleColor }]}>帧率</Text>
            <Text style={[styles.infoValue, { color: textColor }]}>{frameRate.toFixed(6)}</Text>
          </View>
        )}
        {videoStream.bitRate && (
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: subtitleColor }]}>比特率</Text>
            <Text style={[styles.infoValue, { color: textColor }]}>
              {formatBitrate(videoStream.bitRate)}
            </Text>
          </View>
        )}
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: subtitleColor }]}>动态范围</Text>
          <Text style={[styles.infoValue, { color: textColor }]}>
            {videoStream.videoRange || 'Unknown'}
          </Text>
        </View>
        {videoStream.profile && (
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: subtitleColor }]}>配置</Text>
            <Text style={[styles.infoValue, { color: textColor }]}>{videoStream.profile}</Text>
          </View>
        )}
        {videoStream.level !== null && videoStream.level !== undefined && (
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: subtitleColor }]}>等级</Text>
            <Text style={[styles.infoValue, { color: textColor }]}>
              {videoStream.level.toFixed(1)}
            </Text>
          </View>
        )}
        {aspectRatio && (
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: subtitleColor }]}>长宽比</Text>
            <Text style={[styles.infoValue, { color: textColor }]}>{aspectRatio}</Text>
          </View>
        )}
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: subtitleColor }]}>交错</Text>
          <Text style={[styles.infoValue, { color: textColor }]}>
            {videoStream.isInterlaced ? '是' : '否'}
          </Text>
        </View>
        {videoStream.bitDepth && (
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: subtitleColor }]}>位深</Text>
            <Text style={[styles.infoValue, { color: textColor }]}>{videoStream.bitDepth}</Text>
          </View>
        )}
        {videoStream.pixelFormat && (
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: subtitleColor }]}>像素格式</Text>
            <Text style={[styles.infoValue, { color: textColor }]}>{videoStream.pixelFormat}</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const AudioInfoCard = ({ source }: { source: MediaSource }) => {
  const textColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text');
  const subtitleColor = useThemeColor({ light: '#666', dark: '#999' }, 'text');
  const bgColor = useThemeColor({ light: '#f5f5f5', dark: '#2a2a2a' }, 'background');

  const audioStreams = source.mediaStreams.filter((s) => s.type === 'Audio');

  if (audioStreams.length === 0) return null;

  const audioStream = audioStreams[0];

  const titleParts = [
    audioStream.language || 'Unknown',
    audioStream.title ? `- ${audioStream.title}` : null,
  ].filter(Boolean);

  return (
    <View style={[styles.infoCard, { backgroundColor: bgColor }]}>
      <Text style={[styles.cardTitle, { color: textColor }]}>♪ 音频</Text>
      <View style={styles.infoGrid}>
        {titleParts.length > 0 && (
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: subtitleColor }]}>标题</Text>
            <Text style={[styles.infoValue, { color: textColor }]}>{titleParts.join(' ')}</Text>
          </View>
        )}
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: subtitleColor }]}>语言</Text>
          <Text style={[styles.infoValue, { color: textColor }]}>
            {audioStream.language || 'Unknown language'}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: subtitleColor }]}>布局</Text>
          <Text style={[styles.infoValue, { color: textColor }]}>
            {audioStream.channelLayout || 'Unknown'}
          </Text>
        </View>
        {audioStream.channels && (
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: subtitleColor }]}>声道</Text>
            <Text style={[styles.infoValue, { color: textColor }]}>{audioStream.channels}</Text>
          </View>
        )}
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: subtitleColor }]}>编码</Text>
          <Text style={[styles.infoValue, { color: textColor }]}>
            {audioStream.codec || '未知'}
          </Text>
        </View>
        {audioStream.bitRate && (
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: subtitleColor }]}>比特率</Text>
            <Text style={[styles.infoValue, { color: textColor }]}>
              {formatBitrate(audioStream.bitRate)}
            </Text>
          </View>
        )}
        {audioStream.sampleRate && (
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: subtitleColor }]}>采样率</Text>
            <Text style={[styles.infoValue, { color: textColor }]}>{audioStream.sampleRate}Hz</Text>
          </View>
        )}
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: subtitleColor }]}>动态范围</Text>
          <Text style={[styles.infoValue, { color: textColor }]}>Unknown</Text>
        </View>
        {audioStream.audioProfile && (
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: subtitleColor }]}>配置</Text>
            <Text style={[styles.infoValue, { color: textColor }]}>{audioStream.audioProfile}</Text>
          </View>
        )}
        {audioStream.level !== null && audioStream.level !== undefined && (
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: subtitleColor }]}>等级</Text>
            <Text style={[styles.infoValue, { color: textColor }]}>
              {audioStream.level.toFixed(1)}
            </Text>
          </View>
        )}
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: subtitleColor }]}>外部</Text>
          <Text style={[styles.infoValue, { color: textColor }]}>否</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: subtitleColor }]}>默认</Text>
          <Text style={[styles.infoValue, { color: textColor }]}>
            {audioStream.isDefault ? '是' : '否'}
          </Text>
        </View>
      </View>
    </View>
  );
};

export const EpisodeModeContent = ({
  seasons,
  episodes = [],
  people,
  similarItems,
  item,
  seasonId,
}: {
  seasons: MediaItem[];
  episodes?: MediaItem[];
  people: MediaPerson[];
  similarItems: MediaItem[];
  item: MediaItem;
  seasonId?: string;
}) => {
  const textColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text');
  const subtitleColor = useThemeColor({ light: '#666', dark: '#999' }, 'text');
  const { setTitle, setBackgroundImageUrl, setSelectedItem } = useDetailView();
  const mediaAdapter = useMediaAdapter();
  const { currentServer } = useMediaServers();

  const [selectedSeasonId, setSelectedSeasonId] = useState<string>(() => {
    return seasonId || (seasons.length > 0 ? seasons[0].id : '');
  });

  const [selectedEpisode, setSelectedEpisode] = useState<MediaItem>(item ?? episodes[0]);
  const flatListRef = useRef<FlatList<MediaItem>>(null);

  const { data: currentSeasonEpisodes = [] } = useQuery({
    queryKey: ['episodes', selectedSeasonId, currentServer?.userId],
    queryFn: async () => {
      if (!currentServer || !selectedSeasonId) return [];
      const response = await mediaAdapter.getEpisodesBySeason({
        seasonId: selectedSeasonId,
        userId: currentServer.userId,
      });
      return response.data.Items ?? [];
    },
    enabled: !!currentServer && !!selectedSeasonId,
  });

  const { data: mediaSourcesData } = useQuery({
    queryKey: ['mediaSources', selectedEpisode?.id, currentServer?.userId],
    queryFn: async () => {
      if (!selectedEpisode?.id) return null;
      return await mediaAdapter.getItemMediaSources({
        itemId: selectedEpisode.id,
      });
    },
    enabled: !!selectedEpisode?.id,
  });

  const mediaSources = mediaSourcesData?.mediaSources ?? [];

  const displayEpisodes = selectedSeasonId ? currentSeasonEpisodes : episodes;

  useEffect(() => {
    if (displayEpisodes.length === 0) return;

    const episodeExists = displayEpisodes.some((e) => e.id === selectedEpisode.id);
    if (!episodeExists) {
      setSelectedEpisode(displayEpisodes[0]);
    }
  }, [displayEpisodes, selectedEpisode]);

  useEffect(() => {
    const index = displayEpisodes.findIndex((e) => e.id === selectedEpisode.id);
    if (flatListRef.current && index >= 0) {
      flatListRef.current.scrollToIndex({ index, animated: true, viewOffset: 20 });
    }
  }, [displayEpisodes, selectedEpisode]);

  useEffect(() => {
    setTitle(selectedEpisode.name);
    setSelectedItem(selectedEpisode);

    const imageInfo = mediaAdapter.getImageInfo({ item: selectedEpisode });
    setBackgroundImageUrl(imageInfo.url);
  }, [selectedEpisode, setTitle, setSelectedItem, mediaAdapter, setBackgroundImageUrl]);

  return (
    <>
      <View style={{ gap: 8 }}>
        {/* 修改：显示 SxxExx 格式 */}
        <ThemedText style={{ fontSize: 14, color: subtitleColor }}>
          {`${selectedEpisode.seriesName} S${selectedEpisode.parentIndexNumber ?? 1}E${selectedEpisode.indexNumber} - ${selectedEpisode.name}`}
        </ThemedText>
      </View>

      {!!selectedEpisode?.id && <PlayButton item={selectedEpisode} />}

      <ItemOverview item={selectedEpisode} />

      {seasons && seasons.length > 0 && (
        <View
          style={[
            detailViewStyles.sectionBlock,
            { flexDirection: 'row', alignItems: 'center', gap: 12 },
          ]}
        >
          <MenuView
            actions={seasons.map((season) => ({
              id: season.id!,
              title: season.name || `第${season.indexNumber}季`,
              state: season.id === selectedSeasonId ? 'on' : 'off',
            }))}
            onPressAction={({ nativeEvent }) => {
              setSelectedSeasonId(nativeEvent.event);
            }}
          >
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Text style={{ color: textColor, fontSize: 16 }}>
                {seasons.find((s) => s.id === selectedSeasonId)?.name ||
                  `第${seasons.find((s) => s.id === selectedSeasonId)?.indexNumber}季`}
              </Text>
              <Ionicons name="chevron-down" size={16} color={textColor} />
            </TouchableOpacity>
          </MenuView>
        </View>
      )}

      {displayEpisodes && displayEpisodes.length > 0 && (
        <View style={detailViewStyles.sectionBlock}>
          <FlatList
            ref={flatListRef}
            horizontal
            data={displayEpisodes}
            style={detailViewStyles.edgeToEdge}
            onScrollToIndexFailed={() => {
              setTimeout(() => {
                const index = displayEpisodes.findIndex((e) => e.id === selectedEpisode.id);
                if (flatListRef.current && index >= 0) {
                  flatListRef.current.scrollToIndex({ index, animated: true, viewOffset: 20 });
                }
              }, 50);
            }}
            renderItem={({ item: ep }) => {
              const isSelected = ep.id === selectedEpisode.id;
              return (
                <EpisodeCard
                  item={ep}
                  style={[detailViewStyles.horizontalCard, { opacity: isSelected ? 1 : 0.8 }]}
                  imgType="Primary"
                  onPress={() => {
                    setSelectedEpisode(ep);
                  }}
                  imgInfo={mediaAdapter.getImageInfo({
                    item: ep,
                  })}
                />
              );
            }}
            keyExtractor={(item) => item.id!}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={detailViewStyles.horizontalList}
          />
        </View>
      )}

      {mediaSources.length > 0 && (
        <View style={detailViewStyles.sectionBlock}>
          <Text style={[detailViewStyles.sectionTitle, { color: textColor }]}>媒体信息</Text>
          <FlatList
            horizontal
            data={mediaSources}
            style={detailViewStyles.edgeToEdge}
            renderItem={({ item: source }) => (
              <View style={styles.sourceCardContainer}>
                <VideoInfoCard source={source} />
                <AudioInfoCard source={source} />
              </View>
            )}
            keyExtractor={(item, index) => item.id || `source-${index}`}
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
            keyExtractor={(item) => `${item.id ?? item.name}-${item.role ?? ''}`}
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

const styles = StyleSheet.create({
  sourceCardContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  infoCard: {
    width: 240,
    minHeight: 400,
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  infoGrid: {
    gap: 6,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  infoLabel: {
    fontSize: 12,
    minWidth: 60,
  },
  infoValue: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
});