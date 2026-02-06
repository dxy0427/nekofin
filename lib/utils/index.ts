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

  let animes = await searchAnimesByKeyword(baseUrl, seriesName ?? '');
  if (animes.length === 0) {
    animes = await searchAnimesByKeyword(baseUrl, originalTitle ?? '');
  }
  if (animes.length === 0) {
    return { comments: [], episodeInfo: undefined };
  }
  const anime = animes[seasonNumber - 1];
  if (anime && episodeNumber) {
    const comments = await getCommentsByEpisodeId(
      baseUrl,
      anime.episodes[episodeNumber - 1].episodeId,
    );
    return {
      comments,
      episodeInfo: {
        animeTitle: anime.animeTitle,
        episodeTitle: anime.episodes[episodeNumber - 1].episodeTitle,
      },
    };
  }
};

export function isNil(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const formatBitrate = (
  bps: number | null | undefined,
  options?: { unit?: 'bits' | 'bytes' },
): string => {
  if (!bps || bps <= 0) return '未知';

  // 输入是 bps (bits per second)
  const useBytes = options?.unit === 'bytes';

  if (useBytes) {
    // 显示为字节单位 (MB/s, KB/s)
    const MBps = bps / 8 / 1000000; // bps -> MB/s
    const KBps = bps / 8 / 1000; // bps -> KB/s

    if (MBps >= 1) {
      return `${MBps.toFixed(2)} MB/s`;
    } else {
      return `${KBps.toFixed(2)} KB/s`;
    }
  } else {
    // 显示为比特单位 (Mbps, Kbps)
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