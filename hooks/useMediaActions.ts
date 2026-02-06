import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { MediaItem, MediaUserData } from '@/services/media/types';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

export function useMediaActions(item: MediaItem) {
  const router = useRouter();
  const { currentServer } = useMediaServers();
  const mediaAdapter = useMediaAdapter();

  const [localUserData, setLocalUserData] = useState<MediaUserData | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    setLocalUserData(item.userData || null);
    setIsUpdating(false);
  }, [item.id, item.userData]);

  const currentUserData = localUserData || item.userData;

  const handlePlay = () => {
    if (!item.id) return;
    router.push({
      pathname: '/player',
      params: { itemId: item.id },
    });
  };

  const handleAddToFavorites = async () => {
    if (!item.id || !currentServer || isUpdating) return;

    // 乐观更新：立即设置 UI 状态
    setLocalUserData((prev) => ({
      ...prev,
      isFavorite: true,
    }));
    setIsUpdating(true);

    try {
      await mediaAdapter.addFavoriteItem({
        userId: currentServer.userId,
        itemId: item.id,
      });
    } catch (error) {
      // 失败回滚
      setLocalUserData((prev) => ({
        ...prev,
        isFavorite: false,
      }));
      console.error('添加收藏失败:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleMarkAsWatched = async () => {
    if (!item.id || !currentServer || isUpdating) return;

    // 乐观更新
    setLocalUserData((prev) => ({
      ...prev,
      played: true,
      playedPercentage: 100,
    }));
    setIsUpdating(true);

    try {
      await mediaAdapter.markItemPlayed({
        userId: currentServer.userId,
        itemId: item.id,
        datePlayed: new Date().toISOString(),
      });
    } catch (error) {
      // 失败回滚
      setLocalUserData((prev) => ({
        ...prev,
        played: false,
        playedPercentage: prev?.playedPercentage || 0,
      }));
      console.error('标记为已看失败:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleMarkAsUnwatched = async () => {
    if (!item.id || !currentServer || isUpdating) return;

    // 乐观更新
    setLocalUserData((prev) => ({
      ...prev,
      played: false,
      playedPercentage: 0,
    }));
    setIsUpdating(true);

    try {
      await mediaAdapter.markItemUnplayed({
        userId: currentServer.userId,
        itemId: item.id,
      });
    } catch (error) {
      // 失败回滚
      setLocalUserData((prev) => ({
        ...prev,
        played: true,
        playedPercentage: prev?.playedPercentage || 100,
      }));
      console.error('标记为未看失败:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  return {
    currentUserData,
    isUpdating,
    handlePlay,
    handleAddToFavorites,
    handleMarkAsWatched,
    handleMarkAsUnwatched,
  };
}