import { MediaItem, MediaServerInfo } from '@/services/media/types';
import { useCallback, useEffect, useRef } from 'react';
import { SharedValue } from 'react-native-reanimated';

import { useMediaAdapter } from './useMediaAdapter';

interface UsePlaybackSyncProps {
  currentServer: MediaServerInfo | null;
  itemDetail: MediaItem | null;
  currentTime: SharedValue<number>;
  playSessionId: string | null;
  isPlaying: boolean;
}

export const usePlaybackSync = ({
  currentServer,
  itemDetail,
  currentTime,
  playSessionId,
  isPlaying,
}: UsePlaybackSyncProps) => {
  const mediaAdapter = useMediaAdapter();
  const hasStartedRef = useRef(false);

  const syncPlaybackProgress = useCallback(
    (position: number, isPaused: boolean = false) => {
      if (!currentServer || !itemDetail || !playSessionId) return;

      const positionTicks = Math.round(position);
      mediaAdapter.reportPlaybackProgress({
        itemId: itemDetail.id!,
        positionTicks,
        isPaused,
        PlaySessionId: playSessionId,
      });
    },
    [mediaAdapter, currentServer, itemDetail, playSessionId],
  );

  const syncPlaybackStart = useCallback(
    (position: number) => {
      if (!currentServer || !itemDetail || !playSessionId) return;

      const positionTicks = Math.round(position);
      mediaAdapter.reportPlaybackStart({
        itemId: itemDetail.id!,
        positionTicks,
        PlaySessionId: playSessionId,
      });
    },
    [mediaAdapter, currentServer, itemDetail, playSessionId],
  );

  const syncPlaybackStop = useCallback(
    (position: number) => {
      if (!currentServer || !itemDetail || !playSessionId) return;

      const positionTicks = Math.round(position);
      mediaAdapter.reportPlaybackStop({
        itemId: itemDetail.id!,
        positionTicks,
        PlaySessionId: playSessionId,
      });
    },
    [mediaAdapter, currentServer, itemDetail, playSessionId],
  );

  useEffect(() => {
    if (isPlaying && !hasStartedRef.current && currentServer && itemDetail && playSessionId) {
      const startPos = currentTime.value;
      syncPlaybackStart(startPos);
      hasStartedRef.current = true;
    }
  }, [isPlaying, currentServer, itemDetail, playSessionId, syncPlaybackStart]);

  useEffect(() => {
    return () => {
      if (currentServer && itemDetail && playSessionId && hasStartedRef.current) {
        const positionTicks = Math.round(currentTime.value);
        syncPlaybackStop(positionTicks);
      }
    };
  }, [mediaAdapter, currentServer, itemDetail, playSessionId, syncPlaybackStop]);

  return {
    syncPlaybackProgress,
    syncPlaybackStart,
    syncPlaybackStop,
  };
};