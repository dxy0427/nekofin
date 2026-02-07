import download from '@/lib/profiles/download';
import { getDeviceId } from '@/lib/utils';
import { Api, Jellyfin, RecommendedServerInfo } from '@jellyfin/sdk';
import {
  BaseItemDto,
  BaseItemKind,
  ItemSortBy,
  MediaSourceInfo,
} from '@jellyfin/sdk/lib/generated-client/models';
import {
  getFilterApi,
  getItemsApi,
  getLibraryApi,
  getMediaInfoApi,
  getPlaystateApi,
  getSearchApi,
  getSystemApi,
  getTvShowsApi,
  getUserApi,
  getUserLibraryApi,
  getUserViewsApi,
} from '@jellyfin/sdk/lib/utils/api';

import { MediaServerInfo } from '../types';

let jellyfin: Jellyfin | null = null;
let apiInstance: Api | null = null;
let apiInstancesByServerId: Record<string, Api> = {};

export function getJellyfinInstance() {
  if (!jellyfin) {
    jellyfin = new Jellyfin({
      clientInfo: {
        name: 'Nekofin',
        version: '1.0.0',
      },
      deviceInfo: {
        name: 'Nekofin Device',
        id: getDeviceId(),
      },
    });
  }
  return jellyfin;
}

export function getApiInstance(): Api | null {
  return apiInstance;
}

export function setGlobalApiInstance(api: Api | null) {
  apiInstance = api;
}

export async function discoverServers(host: string) {
  const jellyfin = getJellyfinInstance();
  return await jellyfin.discovery.getRecommendedServerCandidates(host);
}

export function findBestServer(servers: RecommendedServerInfo[]) {
  const jellyfin = getJellyfinInstance();
  return jellyfin.discovery.findBestServer(servers);
}

export function createApi(address: string) {
  const jellyfin = getJellyfinInstance();
  const api = jellyfin.createApi(address);
  return api;
}

export async function getSystemInfo(api: Api) {
  return await getSystemApi(api).getPublicSystemInfo();
}

export async function getPublicUsers(api: Api) {
  return await getUserApi(api).getPublicUsers();
}

export async function login(api: Api, username: string, password: string) {
  return await api.authenticateUserByName(username, password);
}

export async function getLatestItems(
  api: Api,
  userId: string,
  limit: number = 100,
  opts?: {
    includeItemTypes?: BaseItemKind[];
    sortBy?: ItemSortBy[];
    sortOrder?: 'Ascending' | 'Descending';
    year?: number;
    tags?: string[];
  },
) {
  return await getItemsApi(api).getItems({
    userId,
    limit,
    sortBy: opts?.sortBy ?? ['DateCreated'],
    sortOrder: [opts?.sortOrder ?? 'Descending'],
    includeItemTypes: opts?.includeItemTypes ?? ['Movie', 'Series', 'Episode'],
    recursive: true,
    filters: ['IsNotFolder'],
    years: opts?.year ? [opts.year] : undefined,
    tags: opts?.tags,
  });
}

export async function getLatestItemsByFolder(
  api: Api,
  userId: string,
  folderId: string,
  limit: number = 100,
) {
  return await getUserLibraryApi(api).getLatestMedia({
    userId,
    limit,
    fields: ['PrimaryImageAspectRatio', 'Path'],
    imageTypeLimit: 1,
    enableImageTypes: ['Primary', 'Backdrop', 'Thumb'],
    parentId: folderId,
  });
}

export async function getNextUpItems(api: Api, userId: string, limit: number = 100) {
  return await getTvShowsApi(api).getNextUp({
    userId,
    limit,
    fields: ['PrimaryImageAspectRatio', 'DateCreated', 'MediaSourceCount'],
    imageTypeLimit: 1,
    enableImageTypes: ['Primary', 'Backdrop', 'Banner', 'Thumb'],
  });
}

export async function getNextUpItemsByFolder(
  api: Api,
  userId: string,
  folderId: string,
  limit: number = 100,
) {
  return await getTvShowsApi(api).getNextUp({
    userId,
    limit,
    parentId: folderId,
  });
}

export async function getResumeItems(api: Api, userId: string, limit: number = 100) {
  return await getItemsApi(api).getResumeItems({
    userId,
    limit,
    fields: ['PrimaryImageAspectRatio'],
    imageTypeLimit: 1,
    enableImageTypes: ['Primary', 'Backdrop', 'Thumb'],
    mediaTypes: ['Video'],
    enableTotalRecordCount: false,
  });
}

export async function getFavoriteItems(api: Api, userId: string, limit: number = 200) {
  return await getItemsApi(api).getItems({
    userId,
    limit,
    sortBy: ['DateCreated'],
    sortOrder: ['Descending'],
    fields: ['PrimaryImageAspectRatio', 'Path'],
    imageTypeLimit: 1,
    enableImageTypes: ['Primary', 'Backdrop', 'Thumb'],
    filters: ['IsFavorite'],
    recursive: true,
    includeItemTypes: ['Movie', 'Series', 'Episode', 'BoxSet', 'Season'],
  });
}

export async function getFavoriteItemsPaged(
  api: Api,
  userId: string,
  startIndex: number = 0,
  limit: number = 40,
  opts?: {
    includeItemTypes?: BaseItemKind[];
    sortBy?: ItemSortBy[];
    sortOrder?: 'Ascending' | 'Descending';
    onlyUnplayed?: boolean;
    year?: number;
    tags?: string[];
  },
) {
  const filters: ('IsFavorite' | 'IsPlayed' | 'IsUnplayed')[] = ['IsFavorite'];
  if (opts?.onlyUnplayed) filters.push('IsUnplayed');
  return await getItemsApi(api).getItems({
    userId,
    startIndex,
    limit,
    sortBy: opts?.sortBy ?? ['DateCreated'],
    sortOrder: [opts?.sortOrder ?? 'Descending'],
    fields: ['PrimaryImageAspectRatio', 'Path'],
    imageTypeLimit: 1,
    enableImageTypes: ['Primary', 'Backdrop', 'Thumb'],
    filters,
    recursive: true,
    // 修复：确保包含 BoxSet 和 Season
    includeItemTypes: opts?.includeItemTypes ?? ['Movie', 'Series', 'Episode', 'BoxSet', 'Season'],
    years: opts?.year ? [opts.year] : undefined,
    tags: opts?.tags,
  });
}

export async function logout(api: Api) {
  return await api.logout();
}

export async function getUserInfo(api: Api, userId: string) {
  return await getUserApi(api).getUserById({ userId });
}

export function getApiInstances() {
  return apiInstancesByServerId;
}

export function getCachedApiByServerId(serverId: string) {
  return apiInstancesByServerId[serverId] ?? null;
}

export function setCachedApiForServer(serverId: string, api: Api) {
  apiInstancesByServerId[serverId] = api;
}

export function deleteCachedApiForServer(serverId: string) {
  delete apiInstancesByServerId[serverId];
}

export function createApiFromServerInfo(serverInfo: MediaServerInfo) {
  const key = serverInfo.id || `${serverInfo.address}_${serverInfo.userId}`;
  const existing = key ? apiInstancesByServerId[key] : undefined;
  if (existing) {
    if (existing.basePath !== serverInfo.address) {
      const recreated = createApi(serverInfo.address);
      recreated.accessToken = serverInfo.accessToken;
      apiInstancesByServerId[key] = recreated;
      return recreated;
    }
    existing.accessToken = serverInfo.accessToken;
    return existing;
  }
  const jf = getJellyfinInstance();
  const api = jf.createApi(serverInfo.address);
  api.accessToken = serverInfo.accessToken;
  if (key) apiInstancesByServerId[key] = api;
  return api;
}

export async function authenticateAndSaveServer(
  address: string,
  username: string,
  password: string,
  addServer: (server: Omit<MediaServerInfo, 'id' | 'createdAt'>) => Promise<void>,
) {
  const api = createApi(address);
  const authResult = await login(api, username, password);

  if (authResult.data?.User?.Id && authResult.data?.AccessToken) {
    const normalizedAddress = address.replace(/\/$/, '');
    const systemInfo = await getSystemInfo(api);
    const serverInfo: Omit<MediaServerInfo, 'id' | 'createdAt'> = {
      address: normalizedAddress,
      name: systemInfo.data?.ServerName || normalizedAddress,
      userId: authResult.data.User.Id,
      username: authResult.data.User.Name || username,
      userAvatar: `${normalizedAddress}/Users/${authResult.data.User.Id}/Images/Primary?quality=90`,
      accessToken: authResult.data.AccessToken,
      type: 'jellyfin',
    };

    await addServer(serverInfo);
    return authResult;
  }

  throw new Error('Authentication failed');
}

export async function getItemDetail(api: Api, itemId: string, userId: string) {
  return await getUserLibraryApi(api).getItem({
    itemId,
    userId,
  });
}

export async function getItemMediaSources(api: Api, itemId: string) {
  return await getMediaInfoApi(api).getPlaybackInfo(
    {
      itemId,
    },
    {
      method: 'POST',
      data: {
        isPlayback: true,
        autoOpenLiveStream: true,
      },
    },
  );
}

export async function getUserView(api: Api, userId: string) {
  return await getUserViewsApi(api).getUserViews({
    userId,
  });
}

export async function getAllItemsByFolder(
  api: Api,
  userId: string,
  folderId: string,
  startIndex: number = 0,
  limit: number = 200,
  itemTypes: BaseItemKind[] = ['Movie', 'Series', 'Episode'],
  opts?: {
    sortBy?: ItemSortBy[];
    sortOrder?: 'Ascending' | 'Descending';
    onlyUnplayed?: boolean;
    year?: number;
    tags?: string[];
  },
) {
  const filters: ('IsPlayed' | 'IsUnplayed')[] = [];
  if (opts?.onlyUnplayed) filters.push('IsUnplayed');
  return await getItemsApi(api).getItems({
    userId,
    parentId: folderId,
    recursive: true,
    limit,
    sortBy: opts?.sortBy ?? ['DateCreated'],
    sortOrder: [opts?.sortOrder ?? 'Descending'],
    fields: ['PrimaryImageAspectRatio', 'Path'],
    imageTypeLimit: 1,
    enableImageTypes: ['Primary', 'Backdrop', 'Thumb'],
    includeItemTypes: itemTypes,
    startIndex,
    filters,
    years: opts?.year ? [opts.year] : undefined,
    tags: opts?.tags,
  });
}

export async function getSeasonsBySeries(api: Api, seriesId: string, userId: string) {
  return await getItemsApi(api).getItems({
    userId,
    parentId: seriesId,
    includeItemTypes: ['Season'],
    recursive: false,
    sortBy: ['IndexNumber'],
    sortOrder: ['Ascending'],
    fields: ['PrimaryImageAspectRatio'],
    imageTypeLimit: 1,
    enableImageTypes: ['Primary', 'Backdrop', 'Thumb'],
  });
}

export async function getEpisodesBySeason(api: Api, seasonId: string, userId: string) {
  return await getTvShowsApi(api).getEpisodes({
    userId,
    seasonId,
    fields: ['ItemCounts', 'PrimaryImageAspectRatio', 'CanDelete', 'MediaSourceCount', 'Overview'],
    seriesId: seasonId,
  });
}

export async function getSimilarShows(
  api: Api,
  itemId: string,
  userId: string,
  limit: number = 30,
) {
  return await getLibraryApi(api).getSimilarShows({
    itemId,
    userId,
    limit,
    fields: ['PrimaryImageAspectRatio'],
  });
}

export async function getSimilarMovies(
  api: Api,
  itemId: string,
  userId: string,
  limit: number = 30,
) {
  return await getLibraryApi(api).getSimilarMovies({
    itemId,
    userId,
    limit,
    fields: ['PrimaryImageAspectRatio'],
  });
}

export async function getSearchHints(
  api: Api,
  searchTerm: string,
  userId?: string,
  limit: number = 10,
) {
  return await getSearchApi(api).getSearchHints({
    searchTerm,
    userId,
    limit,
    includeMedia: true,
    includePeople: false,
    includeGenres: false,
    includeStudios: false,
    includeArtists: false,
  });
}

export async function searchItems(
  api: Api,
  userId: string,
  searchTerm: string,
  limit: number = 100,
  includeItemTypes: BaseItemKind[] = ['Movie', 'Series', 'Episode'],
): Promise<BaseItemDto[]> {
  const res = await getItemsApi(api).getItems({
    userId,
    searchTerm,
    limit,
    recursive: true,
    sortBy: ['SortName'],
    sortOrder: ['Ascending'],
    includeItemTypes,
    fields: ['PrimaryImageAspectRatio'],
    imageTypeLimit: 1,
    enableImageTypes: ['Primary', 'Backdrop', 'Thumb'],
  });
  return res.data?.Items ?? [];
}

export async function getRecommendedSearchKeywords(api: Api, userId: string, limit: number = 20) {
  const res = await getItemsApi(api).getItems({
    userId,
    limit,
    recursive: true,
    includeItemTypes: ['Movie', 'Series', 'MusicArtist'],
    sortBy: ['IsFavoriteOrLiked', 'Random'],
    imageTypeLimit: 0,
    enableTotalRecordCount: false,
    enableImages: false,
  });
  const items = res.data?.Items ?? [];
  const titles = items.map((i) => i.Name).filter((v): v is string => Boolean(v));
  return Array.from(new Set(titles)).slice(0, limit);
}

export async function getRandomItems(
  api: Api,
  userId: string,
  limit: number = 20,
): Promise<BaseItemDto[]> {
  const res = await getItemsApi(api).getItems({
    userId,
    limit,
    recursive: true,
    includeItemTypes: ['Movie', 'Series'],
    sortBy: ['Random'],
    fields: ['ParentId'],
    imageTypeLimit: 0,
    enableTotalRecordCount: false,
    enableImages: false,
  });
  return res.data?.Items ?? [];
}

export type AvailableFilters = {
  years: number[];
  tags: string[];
  genres: string[];
};

export async function getAvailableFilters(
  api: Api,
  userId: string,
  parentId?: string,
): Promise<AvailableFilters> {
  const res = await getFilterApi(api).getQueryFiltersLegacy({ userId, parentId });
  const d = res.data as { Years?: number[]; Tags?: string[]; Genres?: string[] };
  return {
    years: Array.isArray(d?.Years)
      ? d!.Years!.filter((x): x is number => typeof x === 'number')
      : [],
    tags: Array.isArray(d?.Tags) ? d!.Tags!.filter((x): x is string => typeof x === 'string') : [],
    genres: Array.isArray(d?.Genres)
      ? d!.Genres!.filter((x): x is string => typeof x === 'string')
      : [],
  };
}

export async function addFavoriteItem(api: Api, userId: string, itemId: string) {
  return await getUserLibraryApi(api).markFavoriteItem({ userId, itemId });
}

export async function removeFavoriteItem(api: Api, userId: string, itemId: string) {
  return await getUserLibraryApi(api).unmarkFavoriteItem({ userId, itemId });
}

export async function markItemPlayed(
  api: Api,
  userId: string,
  itemId: string,
  datePlayed?: string,
) {
  return await getPlaystateApi(api).markPlayedItem({ itemId, userId, datePlayed });
}

export async function markItemUnplayed(api: Api, userId: string, itemId: string) {
  return await getPlaystateApi(api).markUnplayedItem({ itemId, userId });
}

export async function reportPlaybackProgress(
  api: Api,
  itemId: string,
  positionTicks: number,
  isPaused: boolean = false,
  PlaySessionId: string,
) {
  await getPlaystateApi(api).reportPlaybackProgress({
    playbackProgressInfo: {
      ItemId: itemId,
      PositionTicks: Math.floor(positionTicks * 10000),
      IsPaused: isPaused,
      CanSeek: true,
      PlaybackStartTimeTicks: Date.now() * 10000,
      PlaySessionId,
    },
  });
}

export async function reportPlaybackStart(
  api: Api,
  itemId: string,
  positionTicks: number = 0,
  PlaySessionId: string,
) {
  await getPlaystateApi(api).reportPlaybackStart({
    playbackStartInfo: {
      ItemId: itemId,
      PositionTicks: Math.floor(positionTicks * 10000),
      CanSeek: true,
      PlaybackStartTimeTicks: Date.now() * 10000,
      PlaySessionId,
    },
  });
}

export async function reportPlaybackStop(
  api: Api,
  itemId: string,
  positionTicks: number,
  PlaySessionId: string,
) {
  await getPlaystateApi(api).reportPlaybackStopped({
    playbackStopInfo: {
      ItemId: itemId,
      PositionTicks: Math.floor(positionTicks * 10000),
      PlaySessionId,
    },
  });
}

export type StreamInfo = {
  url: string | null;
  sessionId: string | null;
  mediaSource: MediaSourceInfo | undefined;
};

interface StreamResult {
  url: string;
  sessionId: string | null;
  mediaSource: MediaSourceInfo | undefined;
}

const getPlaybackUrl = (
  api: Api,
  itemId: string,
  mediaSource: MediaSourceInfo | undefined,
  params: {
    subtitleStreamIndex?: number;
    audioStreamIndex?: number;
    deviceId?: string | null;
    startTimeTicks?: number;
    maxStreamingBitrate?: number;
    userId: string;
    playSessionId?: string | null;
    container?: string;
    static?: string;
  },
): string => {
  let transcodeUrl = mediaSource?.TranscodingUrl;

  if (transcodeUrl) {
    if (params.subtitleStreamIndex === -1) {
      transcodeUrl = transcodeUrl.replace('SubtitleMethod=Encode', 'SubtitleMethod=Hls');
    }

    console.log('Video is being transcoded:', transcodeUrl);
    return `${api.basePath}${transcodeUrl}`;
  }

  const streamParams = new URLSearchParams({
    static: params.static || 'true',
    container: params.container || 'mp4',
    mediaSourceId: mediaSource?.Id || '',
    subtitleStreamIndex: params.subtitleStreamIndex?.toString() || '',
    audioStreamIndex: params.audioStreamIndex?.toString() || '',
    deviceId: params.deviceId || api.deviceInfo.id,
    api_key: api.accessToken,
    startTimeTicks: params.startTimeTicks?.toString() || '0',
    maxStreamingBitrate: params.maxStreamingBitrate?.toString() || '',
    userId: params.userId,
  });

  if (params.playSessionId) {
    streamParams.append('playSessionId', params.playSessionId);
  }

  const directPlayUrl = `${api.basePath}/Videos/${itemId}/stream?${streamParams.toString()}`;

  console.log('Video is being direct played:', directPlayUrl);
  return directPlayUrl;
};

const getDownloadUrl = (
  api: Api,
  itemId: string,
  mediaSource: MediaSourceInfo | undefined,
  sessionId: string | null | undefined,
  params: {
    subtitleStreamIndex?: number;
    audioStreamIndex?: number;
    deviceId?: string | null;
    startTimeTicks?: number;
    maxStreamingBitrate?: number;
    userId: string;
    playSessionId?: string | null;
  },
): StreamResult => {
  let downloadMediaSource = mediaSource;
  if (mediaSource?.TranscodingUrl) {
    downloadMediaSource = {
      ...mediaSource,
      TranscodingUrl: mediaSource.TranscodingUrl.replace('master.m3u8', 'stream'),
    };
  }

  let url = getPlaybackUrl(api, itemId, downloadMediaSource, {
    ...params,
    container: 'ts',
    static: 'false',
  });

  if (!mediaSource?.TranscodingUrl) {
    const urlObj = new URL(url);
    const downloadParams = {
      subtitleMethod: 'Embed',
      enableSubtitlesInManifest: 'true',
      allowVideoStreamCopy: 'true',
      allowAudioStreamCopy: 'true',
    };

    Object.entries(downloadParams).forEach(([key, value]) => {
      urlObj.searchParams.append(key, value);
    });

    url = urlObj.toString();
  }

  return {
    url,
    sessionId: sessionId || null,
    mediaSource,
  };
};

export const getStreamInfo = async ({
  api,
  item,
  userId,
  startTimeTicks = 0,
  maxStreamingBitrate,
  playSessionId,
  deviceProfile,
  audioStreamIndex = 0,
  subtitleStreamIndex = undefined,
  mediaSourceId,
  deviceId,
  alwaysBurnInSubtitleWhenTranscoding,
}: {
  api: Api | null | undefined;
  item: BaseItemDto | null | undefined;
  userId: string | null | undefined;
  startTimeTicks: number;
  maxStreamingBitrate?: number;
  playSessionId?: string | null;
  deviceProfile: any;
  audioStreamIndex?: number;
  subtitleStreamIndex?: number;
  height?: number;
  mediaSourceId?: string | null;
  deviceId?: string | null;
  alwaysBurnInSubtitleWhenTranscoding?: boolean;
}): Promise<StreamInfo | null> => {
  if (!api || !userId || !item?.Id) {
    console.warn('Missing required parameters for getStreamInfo');
    return null;
  }

  let mediaSource: MediaSourceInfo | undefined;
  let sessionId: string | null | undefined;

  if (item.Type === BaseItemKind.Program) {
    console.log('Item is of type program...');
    const res = await getMediaInfoApi(api).getPlaybackInfo(
      {
        userId,
        itemId: item.ChannelId!,
      },
      {
        method: 'POST',
        params: {
          startTimeTicks: 0,
          isPlayback: true,
          autoOpenLiveStream: true,
          maxStreamingBitrate,
          audioStreamIndex,
          alwaysBurnInSubtitleWhenTranscoding,
        },
        data: {
          deviceProfile,
        },
      },
    );

    sessionId = res.data.PlaySessionId || null;
    mediaSource = res.data.MediaSources?.[0];
    const url = getPlaybackUrl(api, item.ChannelId!, mediaSource, {
      subtitleStreamIndex,
      audioStreamIndex,
      deviceId,
      startTimeTicks: 0,
      maxStreamingBitrate,
      userId,
    });

    return {
      url,
      sessionId: sessionId || null,
      mediaSource,
    };
  }

  const res = await getMediaInfoApi(api).getPlaybackInfo(
    {
      itemId: item.Id!,
    },
    {
      method: 'POST',
      data: {
        userId,
        deviceProfile,
        subtitleStreamIndex,
        startTimeTicks,
        isPlayback: true,
        autoOpenLiveStream: true,
        maxStreamingBitrate,
        audioStreamIndex,
        mediaSourceId,
      },
    },
  );

  if (res.status !== 200) {
    console.error('Error getting playback info:', res.status, res.statusText);
  }

  sessionId = res.data.PlaySessionId || null;
  mediaSource = res.data.MediaSources?.[0];

  const url = getPlaybackUrl(api, item.Id!, mediaSource, {
    subtitleStreamIndex,
    audioStreamIndex,
    deviceId,
    startTimeTicks,
    maxStreamingBitrate,
    userId,
    playSessionId: playSessionId || undefined,
  });

  return {
    url,
    sessionId: sessionId || null,
    mediaSource,
  };
};

export const getDownloadStreamInfo = async ({
  api,
  item,
  userId,
  maxStreamingBitrate,
  audioStreamIndex = 0,
  subtitleStreamIndex = undefined,
  mediaSourceId,
  deviceId,
}: {
  api: Api | null | undefined;
  item: BaseItemDto | null | undefined;
  userId: string | null | undefined;
  maxStreamingBitrate?: number;
  audioStreamIndex?: number;
  subtitleStreamIndex?: number;
  mediaSourceId?: string | null;
  deviceId?: string | null;
}): Promise<StreamInfo | null> => {
  if (!api || !userId || !item?.Id) {
    console.warn('Missing required parameters for getDownloadStreamInfo');
    return null;
  }

  const res = await getMediaInfoApi(api).getPlaybackInfo(
    {
      itemId: item.Id!,
    },
    {
      method: 'POST',
      data: {
        userId,
        deviceProfile: download,
        subtitleStreamIndex,
        startTimeTicks: 0,
        isPlayback: true,
        autoOpenLiveStream: true,
        maxStreamingBitrate,
        audioStreamIndex,
        mediaSourceId,
      },
    },
  );

  if (res.status !== 200) {
    console.error('Error getting playback info:', res.status, res.statusText);
  }

  const sessionId = res.data.PlaySessionId || null;
  const mediaSource = res.data.MediaSources?.[0];

  return getDownloadUrl(api, item.Id!, mediaSource, sessionId, {
    subtitleStreamIndex,
    audioStreamIndex,
    deviceId,
    startTimeTicks: 0,
    maxStreamingBitrate,
    userId,
    playSessionId: sessionId || undefined,
  });
};