import { MediaStats, MediaTrack, MediaTracks } from '@/modules/vlc-player';
import { DandanComment } from '@/services/dandanplay';
import { MediaItem, MediaSource, MediaStream } from '@/services/media/types';
import { createContext, useContext } from 'react';
import { SharedValue } from 'react-native-reanimated';

import { EpisodeListDrawerRef } from './EpisodeListDrawer';

export type PlayerContextValue = {
  title: string;
  isPlaying: boolean;
  isLoading: boolean;
  duration: number;
  currentTime: SharedValue<number>;
  onSeek: (position: number) => void;
  onPlayPause: () => void;
  onRateChange?: (newRate: number | null, options?: { remember?: boolean }) => void;
  rate: number;
  
  // VLC 检测到的轨道 (底层)
  tracks?: MediaTracks;
  
  // 当前选中的轨道信息 (UI状态)
  selectedAudioTrackIndex?: number;
  selectedSubtitleTrackIndex?: number;

  onAudioTrackChange?: (trackIndex: number) => void;
  onSubtitleTrackChange?: (trackIndex: number) => void;
  
  hasPreviousEpisode?: boolean;
  hasNextEpisode?: boolean;
  onPreviousEpisode?: () => void;
  onNextEpisode?: () => void;
  mediaStats?: MediaStats | null;

  showControls: boolean;
  setShowControls: (show: boolean) => void;
  fadeAnim: SharedValue<number>;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  isDragging: boolean;
  setIsDragging: (dragging: boolean) => void;
  isGestureSeekingActive: SharedValue<boolean>;
  isVolumeGestureActive: SharedValue<boolean>;
  isBrightnessGestureActive: SharedValue<boolean>;
  hideControlsWithDelay: () => void;
  clearControlsTimeout: () => void;
  onCommentsLoaded?: (
    comments: DandanComment[],
    episodeInfo?: { animeTitle: string; episodeTitle: string },
  ) => void;
  danmakuEpisodeInfo?: { animeTitle: string; episodeTitle: string } | undefined;
  danmakuComments: DandanComment[];

  // 剧集列表相关
  episodes: MediaItem[];
  currentItem?: MediaItem | null;
  isMovie: boolean;
  episodeListDrawerRef: React.RefObject<EpisodeListDrawerRef | null>;
  onEpisodeSelect: (episodeId: string) => void;

  // --- 版本/媒体源管理 ---
  mediaSources: MediaSource[];
  currentMediaSourceId: string | null;
  onMediaSourceChange: (sourceId: string) => void;

  // --- API 提供的字幕流 (用于显示内置字幕) ---
  subtitleStreams: MediaStream[];
};

export const PlayerContext = createContext<PlayerContextValue | null>(null);

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) {
    throw new Error('usePlayer must be used within PlayerContext.Provider');
  }
  return ctx;
}