import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { useDanmakuSettings } from '@/lib/contexts/DanmakuSettingsContext';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { generateDeviceProfile } from '@/lib/profiles/native';
import { storage } from '@/lib/storage';
import {
  formatBitrate,
  getCommentsByItem,
  getDeviceId,
  ticksToMilliseconds,
  ticksToSeconds,
} from '@/lib/utils';
import {
  MediaStats,
  MediaTracks,
  VlcPlayerView,
  VlcPlayerViewRef,
} from '@/modules/vlc-player';
import { DandanComment } from '@/services/dandanplay';
import { SubtitleDeliveryMethod } from '@jellyfin/sdk/lib/generated-client/models';
import { useQuery } from '@tanstack/react-query';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import { usePlaybackSync } from '../../hooks/usePlaybackSync';
import { Controls } from './Controls';
import { DanmakuLayer, DanmakuLayerRef } from './DanmakuLayer';

const LoadingIndicator = ({ title }: { title?: string }) => {
  return (
    <View style={[StyleSheet.absoluteFill, styles.bufferingOverlay]} pointerEvents="none">
      <ActivityIndicator size="large" color="#fff" />
      {title && <Text style={styles.loadingTitle}>{title}</Text>}
    </View>
  );
};

export const VideoPlayer = ({ itemId }: { itemId: string }) => {
  const { currentServer, currentApi } = useMediaServers();
  const router = useRouter();
  const mediaAdapter = useMediaAdapter();
  const { settings, getActiveSource } = useDanmakuSettings();
  const activeSource = getActiveSource();
  const danmakuBaseUrl = activeSource?.url || '';

  const [mediaInfo, setMediaInfo] = useState<{
    duration: number;
    currentTime: number;
  } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isStopped, setIsStopped] = useState(false);
  const [initialTime, setInitialTime] = useState<number>(-1);
  const [tracks, setTracks] = useState<MediaTracks | undefined>(undefined);
  const [rate, setRate] = useState(1);
  const prevRateRef = useRef<number>(1);
  const [mediaStats, setMediaStats] = useState<MediaStats | null>(null);

  // 选中的源ID和字幕流索引
  const [selectedMediaSourceId, setSelectedMediaSourceId] = useState<string | null>(null);
  const [serverSubtitleStreamIndex, setServerSubtitleStreamIndex] = useState<number | undefined>(
    undefined,
  );
  // 记录当前选中的音轨/字幕索引 (UI显示用)
  const [selectedAudioIndex, setSelectedAudioIndex] = useState<number | undefined>(undefined);
  const [selectedSubtitleIndex, setSelectedSubtitleIndex] = useState<number | undefined>(undefined);

  const enableTranscoding = storage.getBoolean('enableTranscoding') ?? false;
  const enableSubtitleBurnIn = storage.getBoolean('enableSubtitleBurnIn') ?? false;
  const maxBitrate = storage.getNumber('maxBitrate') ?? 0;
  const selectedCodec = storage.getString('selectedCodec') ?? 'h264';

  const [danmakuEpisodeInfo, setDanmakuEpisodeInfo] = useState<
    { animeTitle: string; episodeTitle: string } | undefined
  >(undefined);

  const player = useRef<VlcPlayerViewRef>(null);
  const danmakuLayer = useRef<DanmakuLayerRef>(null);
  const currentTime = useSharedValue(0);

  // 1. 获取 Item 详情
  const { data: itemDetail } = useQuery({
    queryKey: ['itemDetail', itemId, currentServer?.userId],
    queryFn: async () => {
      if (!currentServer) return null;
      const data = await mediaAdapter.getItemDetail({ itemId, userId: currentServer.userId });
      return data;
    },
    enabled: !!itemId && !!currentServer,
  });

  // 2. 获取所有的 MediaSources (版本)
  const { data: playbackInfo } = useQuery({
    queryKey: ['mediaSources', itemId, currentServer?.userId],
    queryFn: async () => {
      if (!currentServer) return null;
      return await mediaAdapter.getItemMediaSources({ itemId });
    },
    enabled: !!itemId && !!currentServer,
  });

  const mediaSources = useMemo(() => playbackInfo?.mediaSources ?? [], [playbackInfo]);

  // 初始化 selectedMediaSourceId
  useEffect(() => {
    if (!selectedMediaSourceId && mediaSources.length > 0) {
      setSelectedMediaSourceId(mediaSources[0].id);
    }
  }, [mediaSources, selectedMediaSourceId]);

  const { data: seriesInfo } = useQuery({
    queryKey: ['seriesInfo', itemDetail?.seriesId, currentServer?.userId],
    queryFn: async () => {
      if (!currentServer || !itemDetail?.seriesId) return null;
      const data = await mediaAdapter.getItemDetail({
        itemId: itemDetail.seriesId,
        userId: currentServer.userId,
      });
      return data;
    },
    enabled: !!itemDetail?.seriesId && !!currentServer,
  });

  const [manualComments, setManualComments] = useState<DandanComment[]>([]);
  const [useManualComments, setUseManualComments] = useState(false);

  const { data: autoCommentsData } = useQuery({
    queryKey: ['comments', itemDetail?.id, seriesInfo?.originalTitle, danmakuBaseUrl],
    queryFn: async () => {
      if (!itemDetail || !seriesInfo?.originalTitle || !danmakuBaseUrl) {
        return { comments: [], episodeInfo: undefined };
      }
      return getCommentsByItem(danmakuBaseUrl, itemDetail, seriesInfo.originalTitle);
    },
    enabled: !!itemDetail && !!seriesInfo?.originalTitle && !useManualComments && !!danmakuBaseUrl,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    setDanmakuEpisodeInfo(autoCommentsData?.episodeInfo);
  }, [autoCommentsData?.episodeInfo]);

  const comments = useManualComments ? manualComments : (autoCommentsData?.comments ?? []);

  const handleCommentsLoaded = (
    newComments: DandanComment[],
    episodeInfo?: { animeTitle: string; episodeTitle: string },
  ) => {
    setManualComments(newComments);
    setUseManualComments(true);
    setDanmakuEpisodeInfo(episodeInfo);
  };

  // 3. 获取播放流信息
  const { data: streamInfo, isFetching: isStreamInfoFetching } = useQuery({
    queryKey: [
      'streamInfo',
      itemId,
      currentServer?.userId,
      enableTranscoding,
      maxBitrate,
      enableSubtitleBurnIn,
      selectedCodec,
      selectedMediaSourceId,
      serverSubtitleStreamIndex, // 依赖字幕索引，变化时重新获取流
    ],
    queryFn: async () => {
      if (!currentServer || !itemDetail || !selectedMediaSourceId) return null;

      // 只有在真的要切换流时才重置状态，防止无限重置
      // setIsLoaded(false); // 暂时注释，避免频繁闪烁
      // setIsBuffering(true);

      const streamParams = {
        item: itemDetail,
        userId: currentServer.userId,
        startTimeTicks: itemDetail.userData?.playbackPositionTicks || 0,
        deviceId: getDeviceId(),
        mediaSourceId: selectedMediaSourceId,
        subtitleStreamIndex: serverSubtitleStreamIndex,
      };

      if (!enableTranscoding) {
        return await mediaAdapter.getStreamInfo({
          ...streamParams,
          deviceProfile: generateDeviceProfile(),
        });
      }

      return await mediaAdapter.getStreamInfo({
        ...streamParams,
        deviceProfile: generateDeviceProfile({
          transcode: enableTranscoding,
          maxBitrate: maxBitrate,
          subtitleBurnIn: enableSubtitleBurnIn,
          codec: selectedCodec,
        }),
        alwaysBurnInSubtitleWhenTranscoding: enableSubtitleBurnIn,
      });
    },
    enabled: !!currentServer && !!itemDetail && !!selectedMediaSourceId,
    staleTime: 0,
    gcTime: 0,
  });

  // 获取 API 返回的所有字幕流（包括内置的）
  const subtitleStreams = useMemo(() => {
    return (
      streamInfo?.mediaSource?.mediaStreams?.filter((s) => s.type === 'Subtitle') || []
    );
  }, [streamInfo?.mediaSource]);

  const { syncPlaybackProgress } = usePlaybackSync({
    currentServer,
    itemDetail: itemDetail ?? null,
    currentTime,
    playSessionId: streamInfo?.sessionId ?? null,
  });

  const { data: episodes = [] } = useQuery({
    queryKey: ['episodes', itemDetail?.seasonId, currentServer?.userId],
    queryFn: async () => {
      if (!currentServer || !itemDetail?.seasonId) return [];
      const response = await mediaAdapter.getEpisodesBySeason({
        seasonId: itemDetail.seasonId,
        userId: currentServer.userId,
      });
      return response.data.Items ?? [];
    },
    enabled: !!currentServer && !!itemDetail?.seasonId,
  });

  const showLoading = useMemo(() => {
    return isBuffering || !streamInfo?.url || !isLoaded || isStreamInfoFetching;
  }, [isBuffering, streamInfo?.url, isLoaded, isStreamInfoFetching]);

  const duration = useMemo(() => {
    return ticksToMilliseconds(itemDetail?.runTimeTicks ?? 0) ?? mediaInfo?.duration ?? 0;
  }, [mediaInfo, itemDetail?.runTimeTicks]);

  const formattedTitle = useMemo(() => {
    if (!itemDetail) return '';
    const seriesName = itemDetail.seriesName;
    const seasonNumber = itemDetail.parentIndexNumber;
    const episodeNumber = itemDetail.indexNumber;
    const episodeName = itemDetail.name;

    if (seriesName && seasonNumber != null && episodeNumber != null) {
      return `${seriesName} S${seasonNumber}E${episodeNumber} - ${episodeName}`;
    }
    if (itemDetail.type === 'Movie') {
        return `${itemDetail.name} (${itemDetail.productionYear})`;
    }
    
    return episodeName || seriesName || '';
  }, [itemDetail]);

  useEffect(() => {
    if (itemDetail?.userData?.playbackPositionTicks !== undefined && initialTime === -1) {
      const startTimeMs = Math.round(itemDetail.userData.playbackPositionTicks! / 10000);
      currentTime.value = startTimeMs;
      setInitialTime(ticksToSeconds(itemDetail.userData.playbackPositionTicks!));
    } else if (isStreamInfoFetching) {
      setInitialTime(currentTime.value / 1000);
    }
  }, [itemDetail, currentTime, isStreamInfoFetching, initialTime]);

  useEffect(() => {
    (async () => {
      if (isPlaying) {
        await activateKeepAwakeAsync();
      } else {
        await deactivateKeepAwake();
      }
    })();
  }, [isPlaying]);

  useEffect(() => {
    if (!player.current) return;
    (async () => {
      try {
        const audioTracks = await player.current?.getAudioTracks();
        setTracks((prev) => ({
          ...prev,
          audio: audioTracks ?? [],
        }));
      } catch (error) {
        console.error('Error setting tracks:', error);
      }
    })();
  }, [player, isLoaded]);

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      player.current?.pause();
    } else {
      player.current?.play();
    }
  }, [isPlaying, player]);

  const handleRateChange = useCallback(
    (newRate: number | null, options?: { remember?: boolean }) => {
      if (newRate == null) {
        setRate(prevRateRef.current);
        player.current?.setRate(prevRateRef.current);
        return;
      }
      if (options?.remember === false) {
        setRate(newRate);
        player.current?.setRate(newRate);
        return;
      }
      prevRateRef.current = newRate;
      setRate(newRate);
      player.current?.setRate(newRate);
    },
    [],
  );

  const handleSeek = useCallback(
    (position: number) => {
      currentTime.value = position * duration;
      player.current?.seekTo(position * duration);
      danmakuLayer.current?.seek(position * duration);
      setIsBuffering(false);
    },
    [currentTime, duration, danmakuLayer],
  );

  const handleAudioTrackChange = useCallback(
    (trackIndex: number) => {
      setSelectedAudioIndex(trackIndex);
      player.current?.setAudioTrack(trackIndex);
    },
    [],
  );

  const handleSubtitleTrackChange = useCallback(
    (trackIndex: number) => {
        setSelectedSubtitleIndex(trackIndex);

        if (trackIndex === -1) {
            player.current?.setSubtitleTrack(-1);
            setServerSubtitleStreamIndex(undefined); 
            return;
        }

        // 无论如何先尝试触发服务端的流重载（以支持烧录等）
        setServerSubtitleStreamIndex(trackIndex);
    },
    [],
  );

  const handleMediaSourceChange = useCallback((sourceId: string) => {
    setSelectedMediaSourceId(sourceId);
    setServerSubtitleStreamIndex(undefined);
    setSelectedSubtitleIndex(undefined);
  }, []);

  const handlePreviousEpisode = useCallback(() => {
    if (previousEpisode?.id) router.replace({ pathname: '/player', params: { itemId: previousEpisode.id } });
  }, [previousEpisode, router]);

  const handleNextEpisode = useCallback(() => {
    if (nextEpisode?.id) router.replace({ pathname: '/player', params: { itemId: nextEpisode.id } });
  }, [nextEpisode, router]);

  const handleEpisodeSelect = useCallback((episodeId: string) => {
    router.replace({ pathname: '/player', params: { itemId: episodeId } });
  }, [router]);

  // 安全检查：只有当 url 存在且非空时才渲染 Player
  const shouldRenderPlayer = !!streamInfo?.url && initialTime >= 0;

  return (
    <View style={styles.container}>
      {shouldRenderPlayer && (
        <VlcPlayerView
          ref={player}
          style={styles.video}
          source={{
            uri: streamInfo!.url!, // 确信不为空
            isNetwork: true,
            startPosition: initialTime,
            autoplay: true,
            // 关键修复：不要传 externalSubtitles，除非你非常确定格式正确
            // externalSubtitles: undefined 
          }}
          onVideoProgress={(e) => {
            const { duration, currentTime: newCurrentTime } = e.nativeEvent;
            setIsLoaded(true);
            setMediaInfo({ duration, currentTime: newCurrentTime });
            currentTime.value = newCurrentTime;
            syncPlaybackProgress(newCurrentTime, false);
            setIsBuffering(false);
            setIsPlaying(true);
            setIsStopped(false);
          }}
          onVideoStateChange={async (e) => {
            const { state } = e.nativeEvent;
            if (state === 'Playing') setIsPlaying(true);
            if (state === 'Paused') setIsPlaying(false);
            if (state === 'Buffering') setIsBuffering(true);
          }}
          onVideoLoadEnd={() => setIsLoaded(true)}
          onVideoError={async (e) => {
            const { state } = e.nativeEvent;
            if (state === 'Error') {
              setIsBuffering(false);
              setIsPlaying(false);
              setIsStopped(true);
              Alert.alert('Error', `Error: ${state}`);
            }
          }}
          onMediaStatsChange={(e) => setMediaStats(e.nativeEvent.stats)}
        />
      )}

      {showLoading && (
        <LoadingIndicator
          title={mediaStats?.inputBitrate ? formatBitrate(mediaStats.inputBitrate) : undefined}
        />
      )}

      {comments.length > 0 && initialTime >= 0 && (
        <DanmakuLayer
          ref={danmakuLayer}
          currentTime={currentTime}
          isPlaying={!showLoading && !isStopped && isPlaying}
          comments={comments}
          playbackRate={rate}
          {...settings}
        />
      )}

      <Controls
        isPlaying={isPlaying}
        isLoading={showLoading}
        duration={duration}
        currentTime={currentTime}
        onSeek={handleSeek}
        title={formattedTitle}
        onPlayPause={handlePlayPause}
        onRateChange={handleRateChange}
        rate={rate}
        tracks={tracks}
        
        selectedAudioTrackIndex={selectedAudioIndex}
        selectedSubtitleTrackIndex={selectedSubtitleIndex}
        
        onAudioTrackChange={handleAudioTrackChange}
        onSubtitleTrackChange={handleSubtitleTrackChange}
        
        hasPreviousEpisode={hasPreviousEpisode}
        hasNextEpisode={hasNextEpisode}
        onPreviousEpisode={handlePreviousEpisode}
        onNextEpisode={handleNextEpisode}
        mediaStats={mediaStats}
        onCommentsLoaded={handleCommentsLoaded}
        danmakuEpisodeInfo={danmakuEpisodeInfo}
        danmakuComments={comments}
        episodes={episodes}
        currentItem={itemDetail}
        onEpisodeSelect={handleEpisodeSelect}
        mediaSources={mediaSources}
        currentMediaSourceId={selectedMediaSourceId}
        onMediaSourceChange={handleMediaSourceChange}
        subtitleStreams={subtitleStreams}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    height: '100%',
    width: '100%',
  },
  video: {
    height: '100%',
    width: '100%',
  },
  bufferingOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    top: '50%',
    left: '50%',
    transform: [{ translateX: '-50%' }, { translateY: '-50%' }],
  },
  loadingTitle: {
    marginTop: 16,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
});