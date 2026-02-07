import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { MediaItem, MediaUserData } from '@/services/media/types';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

export function useMediaActions(item: MediaItem) {
  const router = useRouter();
  const { currentServer } = useMediaServers();
  const mediaAdapter = useMediaAdapter();
  const queryClient = useQueryClient();

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

    // 乐观更新
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
      // 成功后刷新缓存，确保 UI 状态和服务器一致
      queryClient.invalidateQueries({ queryKey: ['itemDetail', item.id] });
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
    } catch (error) {
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
      // 关键修复：刷新缓存
      queryClient.invalidateQueries({ queryKey: ['itemDetail', item.id] });
      queryClient.invalidateQueries({ queryKey: ['episodes'] });
      queryClient.invalidateQueries({ queryKey: ['homeSections'] });
    } catch (error) {
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
      // 关键修复：刷新缓存
      queryClient.invalidateQueries({ queryKey: ['itemDetail', item.id] });
      queryClient.invalidateQueries({ queryKey: ['episodes'] });
      queryClient.invalidateQueries({ queryKey: ['homeSections'] });
    } catch (error) {
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