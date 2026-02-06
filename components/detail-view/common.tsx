import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { useSettingsColors } from '@/hooks/useSettingsColors';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useAccentColor } from '@/lib/contexts/ThemeColorContext';
import { formatBitrate, formatDurationFromTicks, formatFileSize } from '@/lib/utils';
import { MediaItem, MediaSource } from '@/services/media/types';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { useQuery } from '@tanstack/react-query';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TextLayoutEvent, TouchableOpacity, View } from 'react-native';
import { MenuAction, MenuView } from '@react-native-menu/menu';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';

import { BottomSheetBackdropModal } from '../BottomSheetBackdropModal';
import { ThemedText } from '../ThemedText';

// 辅助函数：获取媒体源的显示名称 (增加安全检查)
const getMediaSourceLabel = (source: MediaSource) => {
  const videoStream = source.mediaStreams?.find((s) => s.type === 'Video');
  const height = videoStream?.height ? `${videoStream.height}p` : 'Unknown';
  const codec = videoStream?.codec?.toUpperCase() || '';
  const container = source.container || '';
  const size = source.size ? formatFileSize(source.size) : '';
  const bitrate = source.bitrate ? formatBitrate(source.bitrate) : '';
  
  // 过滤掉空字符串，用 ' / ' 连接
  return [height, container, codec, size, bitrate].filter(Boolean).join(' / ');
};

export const PlayButton = ({ item }: { item: MediaItem }) => {
  const router = useRouter();
  const { accentColor } = useAccentColor();
  const textColor = useThemeColor({ light: '#fff', dark: '#fff' }, 'text');
  const optionTitleColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text');
  const separatorColor = useThemeColor({ light: '#e5e5ea', dark: '#38383a' }, 'background');
  const { secondarySystemGroupedBackground, secondaryTextColor } = useSettingsColors();
  const mediaAdapter = useMediaAdapter();
  const { currentServer } = useMediaServers();

  // 获取媒体源信息
  const { data: playbackInfo } = useQuery({
    queryKey: ['mediaSources', item.id, currentServer?.userId],
    queryFn: async () => {
      if (!item.id || !currentServer) return null;
      return await mediaAdapter.getItemMediaSources({ itemId: item.id });
    },
    enabled: !!item.id && !!currentServer,
  });

  const mediaSources = useMemo(() => playbackInfo?.mediaSources ?? [], [playbackInfo]);

  // 状态管理
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [selectedAudioIndex, setSelectedAudioIndex] = useState<number | undefined>(undefined);
  const [selectedSubtitleIndex, setSelectedSubtitleIndex] = useState<number | undefined>(undefined);

  // 默认选中第一个源
  useEffect(() => {
    if (mediaSources.length > 0 && !selectedSourceId) {
      setSelectedSourceId(mediaSources[0].id);
    }
  }, [mediaSources, selectedSourceId]);

  // 获取当前选中的源
  const currentSource = useMemo(
    () => mediaSources.find((s) => s.id === selectedSourceId) || mediaSources[0],
    [mediaSources, selectedSourceId],
  );

  // 安全获取流列表 (修复闪退的关键：添加 ?. 和 ?? [])
  const audioStreams = useMemo(
    () => currentSource?.mediaStreams?.filter((s) => s.type === 'Audio') ?? [],
    [currentSource],
  );

  const subtitleStreams = useMemo(
    () => currentSource?.mediaStreams?.filter((s) => s.type === 'Subtitle') ?? [],
    [currentSource],
  );

  // 自动选择默认轨道
  useEffect(() => {
    if (!currentSource) return;

    // 如果还没选过音频，选默认的或第一个
    if (selectedAudioIndex === undefined && audioStreams.length > 0) {
        const defaultAudio = audioStreams.find((s) => s.isDefault) || audioStreams[0];
        setSelectedAudioIndex(defaultAudio.index);
    }

    // 如果还没选过字幕，选默认/强制的，否则设为-1(关闭)
    if (selectedSubtitleIndex === undefined) {
        const defaultSub = subtitleStreams.find(s => s.isDefault) || subtitleStreams.find(s => s.isForced);
        setSelectedSubtitleIndex(defaultSub ? defaultSub.index : -1);
    }
  }, [currentSource, audioStreams, subtitleStreams, selectedAudioIndex, selectedSubtitleIndex]);


  const progressPercent = useMemo(() => {
    const pct = item.userData?.playedPercentage ?? (item.userData?.played ? 100 : 0);
    if (typeof pct === 'number' && !Number.isNaN(pct)) {
      return Math.max(0, Math.min(100, pct));
    }
    const pos = item.userData?.playbackPositionTicks ?? 0;
    const duration = item.runTimeTicks ?? 0;
    if (pos > 0 && duration > 0) {
      return Math.max(0, Math.min(100, (pos / duration) * 100));
    }
    return 0;
  }, [item]);

  const animatedWidth = useSharedValue(0);

  useEffect(() => {
    animatedWidth.value = withTiming(progressPercent, { duration: 800 });
  }, [progressPercent, animatedWidth]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${animatedWidth.value}%`,
  }));

  const handlePlay = () => {
    if (!item.id) return;
    router.push({
      pathname: '/player',
      params: { 
          itemId: item.id,
          // 传递参数时转为字符串，确保兼容
          mediaSourceId: selectedSourceId ?? '',
          audioStreamIndex: selectedAudioIndex !== undefined ? String(selectedAudioIndex) : '',
          subtitleStreamIndex: selectedSubtitleIndex !== undefined ? String(selectedSubtitleIndex) : ''
      },
    });
  };

  // 构造菜单 Actions
  const sourceActions: MenuAction[] = mediaSources.map(s => ({
      id: s.id,
      title: getMediaSourceLabel(s),
      state: s.id === selectedSourceId ? 'on' : 'off',
  }));

  const audioActions: MenuAction[] = audioStreams.map(s => ({
      id: String(s.index),
      title: s.title || s.language || `Audio ${s.index}`,
      subtitle: s.codec?.toUpperCase(),
      state: s.index === selectedAudioIndex ? 'on' : 'off',
  }));

  const subtitleActions: MenuAction[] = [
      { id: '-1', title: '关闭字幕', state: selectedSubtitleIndex === -1 ? 'on' : 'off' },
      ...subtitleStreams.map(s => ({
          id: String(s.index),
          title: s.title || s.language || `Subtitle ${s.index}`,
          subtitle: s.codec?.toUpperCase(),
          state: s.index === selectedSubtitleIndex ? 'on' : 'off',
      }))
  ];
  
  // 显示文本
  const currentSourceLabel = currentSource ? getMediaSourceLabel(currentSource) : '加载中...';
  
  const currentAudioLabel = audioStreams.find(s => s.index === selectedAudioIndex)?.title 
    || audioStreams.find(s => s.index === selectedAudioIndex)?.language 
    || (audioStreams.length > 0 ? `Audio ${selectedAudioIndex}` : '默认音频');

  const currentSubtitleLabel = selectedSubtitleIndex === -1 ? '关闭' : (
      subtitleStreams.find(s => s.index === selectedSubtitleIndex)?.title 
      || subtitleStreams.find(s => s.index === selectedSubtitleIndex)?.language 
      || (subtitleStreams.length > 0 ? `Subtitle ${selectedSubtitleIndex}` : '关闭')
  );

  return (
    <View>
      {/* 选项区域 - 仅当有数据时显示 */}
      {mediaSources.length > 0 && (
        <View style={[styles.optionsContainer, { backgroundColor: secondarySystemGroupedBackground }]}>
           
           {/* 版本选择 */}
           {mediaSources.length > 1 && (
             <>
               <MenuView
                title="选择版本"
                actions={sourceActions}
                onPressAction={({ nativeEvent }) => setSelectedSourceId(nativeEvent.event)}
               >
                   <TouchableOpacity style={styles.optionRow}>
                       <Ionicons name="layers-outline" size={20} color={secondaryTextColor} />
                       <View style={styles.optionTextContainer}>
                           <Text style={[styles.optionTitle, { color: optionTitleColor }]} numberOfLines={1}>
                               {currentSourceLabel}
                           </Text>
                       </View>
                       <Ionicons name="chevron-down" size={16} color={secondaryTextColor} />
                   </TouchableOpacity>
               </MenuView>
               <View style={[styles.separator, { backgroundColor: separatorColor }]} />
             </>
           )}

           {/* 音频选择 */}
           {audioStreams.length > 1 && (
            <>
               <MenuView
                title="选择音频"
                actions={audioActions}
                onPressAction={({ nativeEvent }) => setSelectedAudioIndex(parseInt(nativeEvent.event))}
               >
                   <TouchableOpacity style={styles.optionRow}>
                       <Ionicons name="musical-notes-outline" size={20} color={secondaryTextColor} />
                       <View style={styles.optionTextContainer}>
                           <Text style={[styles.optionTitle, { color: optionTitleColor }]} numberOfLines={1}>
                               {currentAudioLabel}
                           </Text>
                       </View>
                       <Ionicons name="chevron-down" size={16} color={secondaryTextColor} />
                   </TouchableOpacity>
               </MenuView>
               <View style={[styles.separator, { backgroundColor: separatorColor }]} />
            </>
           )}

           {/* 字幕选择 */}
           {subtitleStreams.length > 0 && (
             <MenuView
              title="选择字幕"
              actions={subtitleActions}
              onPressAction={({ nativeEvent }) => setSelectedSubtitleIndex(parseInt(nativeEvent.event))}
             >
                 <TouchableOpacity style={styles.optionRow}>
                     <Ionicons name="chatbox-ellipses-outline" size={20} color={secondaryTextColor} />
                     <View style={styles.optionTextContainer}>
                         <Text style={[styles.optionTitle, { color: optionTitleColor }]} numberOfLines={1}>
                             {currentSubtitleLabel}
                         </Text>
                     </View>
                     <Ionicons name="chevron-down" size={16} color={secondaryTextColor} />
                 </TouchableOpacity>
             </MenuView>
           )}
        </View>
      )}

      {/* 播放按钮 */}
      <GlassView
        style={[
          detailViewStyles.playButton,
          { borderColor: accentColor, backgroundColor: accentColor },
          isLiquidGlassAvailable() && { borderRadius: 999, backgroundColor: 'transparent' },
        ]}
        isInteractive
        tintColor={`${accentColor}20`}
      >
        {progressPercent > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              detailViewStyles.playButtonProgressFill,
              {
                backgroundColor: accentColor,
                borderRadius: isLiquidGlassAvailable() ? 999 : 8,
              },
              animatedStyle,
            ]}
          />
        )}
        <TouchableOpacity
          onPress={handlePlay}
          style={{
            paddingVertical: 12,
            width: '100%',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[detailViewStyles.playButtonText, { color: textColor }]}>
              {item.runTimeTicks
                ? formatDurationFromTicks(item.runTimeTicks, { showUnits: true })
                : '播放'}
            </Text>
            <Ionicons name="play-circle" size={24} color={textColor} />
          </View>
        </TouchableOpacity>
      </GlassView>
    </View>
  );
};

export const ItemMeta = ({ item }: { item: MediaItem }) => {
  const textColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text');

  const ratingText = useMemo(() => {
    if (typeof item?.communityRating === 'number') return item.communityRating.toFixed(1);
    if (typeof item?.criticRating === 'number') return String(item.criticRating);
    if (item?.officialRating) return item.officialRating;
    return '';
  }, [item?.communityRating, item?.criticRating, item?.officialRating]);

  const yearText = useMemo(() => {
    return typeof item?.productionYear === 'number' ? String(item.productionYear) : '';
  }, [item?.productionYear]);

  return (
    <Text style={[detailViewStyles.meta, { color: textColor }]}>
      {ratingText ? (
        <>
          <Text style={detailViewStyles.star}>★</Text>
          <Text>{` ${ratingText}`}</Text>
          {yearText ? <Text>{` · ${yearText}`}</Text> : null}
        </>
      ) : (
        <>{yearText}</>
      )}
    </Text>
  );
};

export const ItemOverview = ({ item }: { item: MediaItem }) => {
  const textColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text');
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const [textLines, setTextLines] = useState(0);

  const { accentColor } = useAccentColor();

  const overview = item?.overview?.trim() ?? '';

  const handleShowMore = () => {
    bottomSheetModalRef.current?.present();
  };

  const handleTextLayout = (event: TextLayoutEvent) => {
    setTextLines(event.nativeEvent.lines.length);
  };

  if (!overview) return null;

  return (
    <>
      <View style={detailViewStyles.overviewContainer}>
        <Text
          style={[detailViewStyles.overview, { opacity: 0, position: 'absolute' }]}
          onTextLayout={handleTextLayout}
        >
          {overview}
        </Text>
        <Text style={[detailViewStyles.overview, { color: textColor }]} numberOfLines={5}>
          {overview}
        </Text>
        {textLines > 5 && (
          <TouchableOpacity onPress={handleShowMore}>
            <Text style={[detailViewStyles.overview, { color: accentColor }]}>查看更多</Text>
          </TouchableOpacity>
        )}
      </View>

      <BottomSheetBackdropModal ref={bottomSheetModalRef} enableDynamicSizing>
        <BottomSheetView style={detailViewStyles.modalContent}>
          <Text style={[detailViewStyles.modalTitle, { color: textColor }]}>剧情简介</Text>
          <Text style={[detailViewStyles.modalOverview, { color: textColor }]}>{overview}</Text>
        </BottomSheetView>
      </BottomSheetBackdropModal>
    </>
  );
};

export const ItemInfoList = ({ item }: { item: MediaItem }) => {
  const subtitleColor = useThemeColor({ light: '#666', dark: '#999' }, 'text');

  const genreText = useMemo(() => {
    const primary = item?.genres && item.genres.length > 0 ? item.genres : undefined;
    if (primary) return primary.join(', ');
    const fallback = item?.genreItems?.map((g) => g.name).filter(Boolean) ?? [];
    return fallback.join(', ');
  }, [item?.genreItems, item?.genres]);

  const writerText = useMemo(() => {
    const people = item?.people?.filter((p) => p?.type === 'Writer').map((p) => p.name) ?? [];
    return people.filter(Boolean).join(', ');
  }, [item?.people]);

  const studioText = useMemo(() => {
    const studios = item?.studios?.map((s) => s.name) ?? [];
    return studios.filter(Boolean).join(', ');
  }, [item?.studios]);

  if (!genreText && !writerText && !studioText) return null;

  return (
    <View style={detailViewStyles.infoBlock}>
      {!!genreText && (
        <View style={detailViewStyles.infoRow}>
          <Text style={[detailViewStyles.infoLabel, { color: subtitleColor }]}>类型</Text>
          <ThemedText style={detailViewStyles.infoValue}>{genreText}</ThemedText>
        </View>
      )}
      {!!writerText && (
        <View style={detailViewStyles.infoRow}>
          <Text style={[detailViewStyles.infoLabel, { color: subtitleColor }]}>编剧</Text>
          <ThemedText style={detailViewStyles.infoValue}>{writerText}</ThemedText>
        </View>
      )}
      {!!studioText && (
        <View style={detailViewStyles.infoRow}>
          <Text style={[detailViewStyles.infoLabel, { color: subtitleColor }]}>工作室</Text>
          <ThemedText style={detailViewStyles.infoValue}>{studioText}</ThemedText>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
    optionsContainer: {
        borderRadius: 12,
        marginBottom: 16,
        overflow: 'hidden',
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        gap: 12,
    },
    optionTextContainer: {
        flex: 1,
        gap: 2,
    },
    optionTitle: {
        fontSize: 14,
        fontWeight: '600',
    },
    optionSubtitle: {
        fontSize: 12,
    },
    separator: {
        height: 1,
        marginLeft: 44, // 左侧缩进，对齐图标后的文字
    }
});

export const detailViewStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    width: '100%',
    height: '100%',
    backgroundColor: '#eee',
  },
  content: {
    top: -160,
    padding: 20,
    gap: 8,
    marginBottom: -160,
  },
  logo: {
    top: -20,
    width: '100%',
    height: 120,
  },
  meta: {
    fontSize: 14,
  },
  star: {
    color: '#F5C518',
  },
  overview: {
    fontSize: 14,
    lineHeight: 20,
  },
  overviewContainer: {
    gap: 8,
    marginBottom: 8,
  },
  modalContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalOverview: {
    fontSize: 16,
    lineHeight: 24,
  },
  infoBlock: {
    marginTop: 6,
    rowGap: 6,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  infoLabel: {
    fontSize: 14,
    width: 56,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    textAlign: 'left',
  },
  playButton: {
    borderRadius: 8,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
  playButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  playButtonProgressFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
  },
  sectionBlock: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  horizontalList: {
    paddingVertical: 4,
    paddingHorizontal: 20,
    gap: 12,
  },
  edgeToEdge: {
    marginHorizontal: -20,
  },
  horizontalCard: {
    width: 200,
  },
  listContainer: {
    marginTop: 16,
    rowGap: 16,
  },
  listItem: {
    width: '100%',
    gap: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.6,
  },
  lastLineContainer: {
    marginTop: -8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
});