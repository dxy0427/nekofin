import { getCommentsByEpisodeId, searchAnimesByKeyword } from '@/services/dandanplay';
import { MediaItem } from '@/services/media/types';
import { compareVersions } from 'compare-versions';
import { Platform } from 'react-native';
import uuid from 'react-native-uuid';

import { storage } from '../storage';

export const iosVersion = Platform.OS === 'ios' ? Platform.Version : '0';

export const isGreaterThanOrEqual26 = compareVersions(iosVersion, '26.0') >= 0;

export const ticksToSeconds = (ticks: number) => {
  return ticks / 10000000;
};

export const ticksToMilliseconds = (ticks: number) => {
  return ticks / 10000;
};

export const formatTimeWorklet = (time: number) => {
  'worklet';

  const hours = Math.floor(time / 3600000);
  const minutes = Math.floor((time % 3600000) / 60000);
  const seconds = Math.floor((time % 60000) / 1000);

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  } else {
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
};

export const formatDurationFromTicks = (
  ticks?: number | null,
  options?: { showUnits?: boolean },
) => {
  if (!ticks) return '';
  const totalSeconds = Math.floor(ticksToSeconds(ticks));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (options?.showUnits) {
    const parts = [];
    if (hours > 0) {
      parts.push(`${hours}h`);
    }
    if (minutes > 0) {
      parts.push(`${minutes}m`);
    }
    if (seconds > 0 || (hours === 0 && minutes === 0)) {
      parts.push(`${seconds}s`);
    }
    return parts.join('');
  }

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export const getDeviceId = () => {
  const deviceId = storage.getString('deviceId');
  if (!deviceId) {
    const newDeviceId = uuid.v4();
    storage.set('deviceId', newDeviceId);
    return newDeviceId;
  }
  return deviceId;
};

export const getCommentsByItem = async (
  baseUrl: string,
  item: MediaItem,
  originalTitle?: string | null,
) => {
  const seriesName = item.seriesName;
  const seasonNumber = item.parentIndexNumber ?? 1;
  const episodeNumber = item.indexNumber;

  if (!baseUrl) {
    return { comments: [], episodeInfo: undefined };
  }

  // 策略 1: 使用 S{季}E{集} 格式搜索，如 "一念永恒 S2E1"
  let searchKeyword = `${seriesName} S${seasonNumber}E${episodeNumber}`;
  let animes = await searchAnimesByKeyword(baseUrl, searchKeyword);
  
  // 策略 2: 如果搜不到，尝试仅带季号 "一念永恒 S2"
  if (animes.length === 0 && seasonNumber > 1) {
      animes = await searchAnimesByKeyword(baseUrl, `${seriesName} S${seasonNumber}`);
  }

  // 策略 3: 如果还搜不到，尝试仅带剧名
  if (animes.length === 0) {
      animes = await searchAnimesByKeyword(baseUrl, seriesName ?? '');
  }

  // 策略 4: 最后尝试原名
  if (animes.length === 0) {
    animes = await searchAnimesByKeyword(baseUrl, originalTitle ?? '');
  }

  if (animes.length === 0) {
    return { comments: [], episodeInfo: undefined };
  }
  
  // 此时 animes 可能包含多季，通常第一项就是最匹配的（因为我们用了 precise keyword）
  const anime = animes[0]; 
  
  if (anime && episodeNumber) {
    // 检查 episodeNumber 是否越界
    // 注意：如果是用 S2E1 搜到的，可能返回的 anime 下面只有 1 集，或者是整个 S2 的列表
    // 这里假设返回的是列表
    let targetEpIndex = episodeNumber - 1;
    
    // 如果返回的剧集数量少于 index，可能是只搜到了单集（S2E1），此时尝试取第0个
    if (targetEpIndex >= anime.episodes.length && anime.episodes.length === 1) {
        // 这种情况下，可能直接命中了单集条目
        targetEpIndex = 0;
    }

    if (targetEpIndex < anime.episodes.length) {
        const comments = await getCommentsByEpisodeId(
          baseUrl,
          anime.episodes[targetEpIndex].episodeId,
        );
        return {
          comments,
          episodeInfo: {
            animeTitle: anime.animeTitle,
            episodeTitle: anime.episodes[targetEpIndex].episodeTitle,
          },
        };
    }
  }
  return { comments: [], episodeInfo: undefined };
};

export function isNil(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const formatBitrate = (
  bps: number | null | undefined,
  options?: { unit?: 'bits' | 'bytes' },
): string => {
  // 如果是0，也应该允许显示 0.00 KB/s，而不是 "未知"
  if (bps === undefined || bps === null) return '0 KB/s';

  // 输入是 bps (bits per second)
  const useBytes = options?.unit === 'bytes';

  if (useBytes) {
    // 显示为字节单位 (MB/s, KB/s)
    // 修正：使用 1024 进制，符合文件传输习惯
    const Bps = bps / 8;
    const MBps = Bps / (1024 * 1024);
    const KBps = Bps / 1024;

    if (MBps >= 1) {
      return `${MBps.toFixed(2)} MB/s`;
    } else {
      return `${KBps.toFixed(2)} KB/s`;
    }
  } else {
    // 显示为比特单位 (Mbps, Kbps) - 保持 1000 进制 (电信标准)
    const mbps = bps / 1000000; // 转换为 Mbps
    const kbps = bps / 1000; // 转换为 Kbps

    if (mbps >= 1) {
      return `${mbps.toFixed(1)} Mbps`;
    } else if (kbps >= 1) {
      return `${kbps.toFixed(0)} Kbps`;
    } else {
      return `${bps.toFixed(0)} bps`;
    }
  }
};