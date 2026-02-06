import { useDanmakuSettings } from '@/lib/contexts/DanmakuSettingsContext';
import { formatBitrate } from '@/lib/utils'; 
import { DandanComment } from '@/services/dandanplay';
import Ionicons from '@expo/vector-icons/Ionicons';
import { MenuView } from '@react-native-menu/menu';
import { useCallback, useRef } from 'react';
import { StyleProp, StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native';

import { DanmakuSearchModal, DanmakuSearchModalRef } from './DanmakuSearchModal';
import { usePlayer } from './PlayerContext';

type SettingsButtonsProps = {
  style?: StyleProp<ViewStyle>;
};

// 简单的辅助函数，格式化文件大小
const formatSize = (bytes?: number | null) => {
    if (!bytes) return '';
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Byte';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
};

export function SettingsButtons({ style }: SettingsButtonsProps) {
  const {
    tracks,
    onAudioTrackChange,
    onSubtitleTrackChange,
    onRateChange,
    rate,
    setMenuOpen,
    onCommentsLoaded,
    title,
    currentItem,
    mediaSources,
    currentMediaSourceId,
    onMediaSourceChange,
    subtitleStreams, 
    selectedSubtitleTrackIndex,
    selectedAudioTrackIndex,
  } = usePlayer();

  const danmakuSearchModalRef = useRef<DanmakuSearchModalRef>(null);
  const { settings: danmakuSettings, setSettings: setDanmakuSettings } = useDanmakuSettings();

  const audioTracks =
    tracks?.audio?.filter((track) => track.index !== -1).sort((a, b) => a.index - b.index) ?? [];
  
  // 处理字幕列表：API 返回的列表
  const formattedSubtitleTracks = subtitleStreams.map((sub) => ({
      id: sub.index,
      title: sub.title || sub.language || `Track ${sub.index}`,
      isDefault: sub.isDefault,
      type: sub.codec // 显示格式，如 ass, subrip
  }));

  const handleAudioTrackSelect = (trackIndex: number) => {
    onAudioTrackChange?.(trackIndex);
  };

  const handleSubtitleTrackSelect = (trackIndex: number) => {
    onSubtitleTrackChange?.(trackIndex);
  };

  const handleRateSelect = (newRate: number) => {
    onRateChange?.(newRate);
  };

  const handleVersionSelect = (sourceId: string) => {
    onMediaSourceChange?.(sourceId);
  };

  const handleDanmakuToggle = useCallback(() => {
    setDanmakuSettings({
      ...danmakuSettings,
      danmakuFilter: danmakuSettings.danmakuFilter === 15 ? 0 : 15,
    });
  }, [danmakuSettings, setDanmakuSettings]);

  const handleDanmakuSearch = useCallback(() => {
    let keyword = '';
    if (currentItem) {
      keyword = currentItem.seriesName || currentItem.name || '';
    } else if (title) {
      keyword = title.split(' S')[0];
    }
    danmakuSearchModalRef.current?.present(keyword);
  }, [currentItem, title]);

  const handleCommentsLoaded = useCallback(
    (comments: DandanComment[], episodeInfo?: { animeTitle: string; episodeTitle: string }) => {
      onCommentsLoaded?.(comments, episodeInfo);
    },
    [onCommentsLoaded],
  );

  const createMenuAction = <T,>(id: string, title: string, currentValue: T, targetValue: T, subtitle?: string) => ({
    id,
    title,
    subtitle,
    state: currentValue === targetValue ? ('on' as const) : ('off' as const),
  });

  const createRateAction = (rateValue: number) =>
    createMenuAction(`rate_${rateValue}`, `${rateValue}x`, rate, rateValue);

  return (
    <View style={[styles.row, style]}>
      {/* 版本选择菜单 */}
      {mediaSources.length > 1 && (
        <MenuView
          isAnchoredToRight
          onPressAction={({ nativeEvent }) => {
            const key = nativeEvent.event;
            if (key.startsWith('source_')) {
              const sourceId = key.replace('source_', '');
              handleVersionSelect(sourceId);
            }
            setMenuOpen(false);
          }}
          onOpenMenu={() => setMenuOpen(true)}
          onCloseMenu={() => setMenuOpen(false)}
          title="版本选择"
          actions={mediaSources.map((source) => {
            const height = source.mediaStreams.find(s => s.type === 'Video')?.height;
            const res = height ? `${height}p` : 'Unknown';
            const container = source.container || '';
            const codec = source.mediaStreams.find(s => s.type === 'Video')?.codec?.toUpperCase() || '';
            const size = formatSize(source.size);
            const bitrate = source.bitrate ? formatBitrate(source.bitrate) : '';
            
            const label = `${res}.${container}.${codec} / ${size} / ${bitrate}`;
            
            return createMenuAction(
              `source_${source.id}`,
              source.name || 'Version',
              currentMediaSourceId,
              source.id,
              label 
            );
          })}
        >
          <TouchableOpacity style={styles.circleButton}>
            <Ionicons name="layers" size={24} color="white" />
          </TouchableOpacity>
        </MenuView>
      )}

      {/* 音轨选择 */}
      <MenuView
        isAnchoredToRight
        onPressAction={({ nativeEvent }) => {
          const key = nativeEvent.event;
          if (key.startsWith('audio_')) {
            const trackIndex = parseInt(key.replace('audio_', ''));
            handleAudioTrackSelect(trackIndex);
          }
          setMenuOpen(false);
        }}
        onOpenMenu={() => setMenuOpen(true)}
        onCloseMenu={() => setMenuOpen(false)}
        title="音轨选择"
        actions={
          audioTracks.length > 0
            ? audioTracks.map((track) =>
                createMenuAction(
                  `audio_${track.index}`,
                  track.name,
                  selectedAudioTrackIndex,
                  track.index,
                ),
              )
            : [{ id: 'no_audio', title: '无可用音轨', state: 'off' as const }]
        }
      >
        <TouchableOpacity style={styles.circleButton} disabled={audioTracks.length === 0}>
          <Ionicons
            name="musical-notes"
            size={24}
            color={audioTracks.length === 0 ? '#666' : 'white'}
          />
        </TouchableOpacity>
      </MenuView>

      {/* 字幕选择 - 使用 API 数据 */}
      <MenuView
        isAnchoredToRight
        onPressAction={({ nativeEvent }) => {
          const key = nativeEvent.event;
          if (key.startsWith('subtitle_')) {
            const trackIndex = parseInt(key.replace('subtitle_', ''));
            handleSubtitleTrackSelect(trackIndex);
          }
          setMenuOpen(false);
        }}
        onOpenMenu={() => setMenuOpen(true)}
        onCloseMenu={() => setMenuOpen(false)}
        title="字幕选择"
        actions={[
          createMenuAction('subtitle_-1', '关闭字幕', selectedSubtitleTrackIndex, -1),
          ...(formattedSubtitleTracks.length > 0
            ? formattedSubtitleTracks.map((track) =>
                createMenuAction(
                  `subtitle_${track.id}`,
                  track.title,
                  selectedSubtitleTrackIndex,
                  track.id,
                  track.type ? `格式: ${track.type.toUpperCase()}` : undefined
                ),
              )
            : [{ id: 'no_subtitle', title: '无可用字幕', state: 'off' as const }]),
        ]}
      >
        <TouchableOpacity style={styles.circleButton} disabled={formattedSubtitleTracks.length === 0}>
          <Ionicons
            name="chatbox-ellipses"
            size={24}
            color={formattedSubtitleTracks.length === 0 ? '#666' : 'white'}
          />
        </TouchableOpacity>
      </MenuView>

      {/* 播放速度 */}
      <MenuView
        isAnchoredToRight
        onPressAction={({ nativeEvent }) => {
          const key = nativeEvent.event;
          if (key.startsWith('rate_')) {
            const newRate = parseFloat(key.replace('rate_', ''));
            handleRateSelect(newRate);
          }
          setMenuOpen(false);
        }}
        onOpenMenu={() => setMenuOpen(true)}
        onCloseMenu={() => setMenuOpen(false)}
        title="播放速度"
        actions={[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map(createRateAction)}
      >
        <TouchableOpacity style={styles.circleButton}>
          <Ionicons name="speedometer-outline" size={24} color="white" />
        </TouchableOpacity>
      </MenuView>

      {/* 弹幕设置 */}
      <MenuView
        isAnchoredToRight
        onPressAction={({ nativeEvent }) => {
          const key = nativeEvent.event;
          if (key === 'danmaku_toggle') {
            handleDanmakuToggle();
          } else if (key === 'danmaku_search') {
            handleDanmakuSearch();
          }
          setMenuOpen(false);
        }}
        onOpenMenu={() => setMenuOpen(true)}
        onCloseMenu={() => setMenuOpen(false)}
        title="弹幕设置"
        actions={[
          {
            id: 'danmaku_toggle',
            title: danmakuSettings.danmakuFilter === 15 ? '开启弹幕' : '关闭弹幕',
          },
          { id: 'danmaku_search', title: '搜索弹幕' },
        ]}
      >
        <TouchableOpacity style={styles.circleButton}>
          <Ionicons name="chatbubble-ellipses" size={24} color="white" />
        </TouchableOpacity>
      </MenuView>

      <DanmakuSearchModal ref={danmakuSearchModalRef} onCommentsLoaded={handleCommentsLoaded} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  circleButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
});