import { getImageInfo } from '@/lib/utils/image';
import type { Api } from '@jellyfin/sdk';
import { BaseItemDto, BaseItemKind, ItemSortBy } from '@jellyfin/sdk/lib/generated-client/models';
import { DeviceProfile } from '@jellyfin/sdk/lib/generated-client/models/device-profile';

import {
  addFavoriteItem,
  authenticateAndSaveServer,
  createApi,
  createApiFromServerInfo,
  findBestServer,
  getAllItemsByFolder,
  getApiInstance,
  getAvailableFilters,
  getEpisodesBySeason,
  getFavoriteItems,
  getFavoriteItemsPaged,
  getItemDetail,
  getItemMediaSources,
  getJellyfinInstance,
  getLatestItems,
  getLatestItemsByFolder,
  getNextUpItems,
  getNextUpItemsByFolder,
  getPublicUsers,
  getRandomItems,
  getRecommendedSearchKeywords,
  getResumeItems,
  getSeasonsBySeries,
  getSimilarMovies,
  getSimilarShows,
  getStreamInfo,
  getSystemInfo,
  getUserInfo,
  getUserView,
  login as jfLogin,
  logout,
  markItemPlayed,
  markItemUnplayed,
  removeFavoriteItem,
  reportPlaybackProgress,
  reportPlaybackStart,
  reportPlaybackStop,
  searchItems,
  setGlobalApiInstance,
} from '.';
import {
  GetRandomItemsParams,
  MediaAdapter,
  type AuthenticateAndSaveServerParams,
  type CreateApiFromServerInfoParams,
  type CreateApiParams,
  type DiscoverServersParams,
  type FindBestServerParams,
  type GetAllItemsByFolderParams,
  type GetAvailableFiltersParams,
  type GetEpisodesBySeasonParams,
  type GetFavoriteItemsPagedParams,
  type GetFavoriteItemsParams,
  type GetImageInfoParams,
  type GetItemDetailParams,
  type GetItemMediaSourcesParams,
  type GetLatestItemsByFolderParams,
  type GetLatestItemsParams,
  type GetNextUpItemsByFolderParams,
  type GetNextUpItemsParams,
  type GetRecommendedSearchKeywordsParams,
  type GetResumeItemsParams,
  type GetSeasonsBySeriesParams,
  type GetSimilarMoviesParams,
  type GetSimilarShowsParams,
  type GetStreamInfoParams,
  type GetUserInfoParams,
  type GetUserViewParams,
  type LoginParams,
  type MarkItemPlayedParams,
  type MediaItem,
  type MediaItemType,
  type MediaSortBy,
  type ReportPlaybackProgressParams,
  type ReportPlaybackStartParams,
  type ReportPlaybackStopParams,
  type SearchItemsParams,
  type UpdateFavoriteItemParams,
} from '../types';

export function convertBaseItemDtoToMediaItem(item: BaseItemDto): MediaItem {
  return {
    id: item.Id || '',
    name: item.Name || '',
    type: (item.Type as MediaItemType) || 'Other',
    raw: item,
    seriesName: item.SeriesName,
    seriesId: item.SeriesId,
    parentId: item.ParentId,
    indexNumber: item.IndexNumber,
    parentIndexNumber: item.ParentIndexNumber,
    productionYear: item.ProductionYear,
    endDate: item.EndDate,
    status: item.Status as 'Continuing' | 'Ended' | undefined,
    overview: item.Overview,
    communityRating: item.CommunityRating,
    criticRating: item.CriticRating,
    officialRating: item.OfficialRating,
    genres: item.Genres,
    genreItems: item.GenreItems?.map((g) => ({ name: g.Name || '' })),
    people: item.People?.map((p) => ({
      name: p.Name || '',
      id: p.Id || '',
      type: (p.Type as 'Actor' | 'Director' | 'Writer' | 'Producer') || 'Actor',
      role: p.Role,
      primaryImageTag: p.PrimaryImageTag,
      imageBlurHashes: p.ImageBlurHashes,
      raw: p,
    })),
    studios: item.Studios?.map((s) => ({ name: s.Name || '' })),
    userData: item.UserData
      ? {
          played: item.UserData.Played,
          playedPercentage: item.UserData.PlayedPercentage,
          isFavorite: item.UserData.IsFavorite,
          playbackPositionTicks: item.UserData.PlaybackPositionTicks,
        }
      : undefined,
    runTimeTicks: item.RunTimeTicks,
    originalTitle: item.OriginalTitle,
    seasonId: item.SeasonId,
    collectionType: item.CollectionType,
  };
}

function convertSortByToJellyfin(sortBy: MediaSortBy[]): ItemSortBy[] {
  return sortBy.map((sb) => sb as ItemSortBy);
}

function convertItemTypesToJellyfin(itemTypes: MediaItemType[]): BaseItemKind[] {
  return itemTypes.map((it) => it as BaseItemKind);
}

class JellyfinAdapter implements MediaAdapter {
  getApiInstance = getApiInstance;
  setGlobalApiInstance = setGlobalApiInstance;

  async discoverServers({ host }: DiscoverServersParams) {
    const jf = getJellyfinInstance();
    return await jf.discovery.getRecommendedServerCandidates(host);
  }

  findBestServer({ servers }: FindBestServerParams) {
    const best = findBestServer(servers);
    return best ?? null;
  }

  createApi({ address }: CreateApiParams) {
    return createApi(address);
  }
  createApiFromServerInfo({ serverInfo }: CreateApiFromServerInfoParams): Api {
    return createApiFromServerInfo(serverInfo);
  }

  async getSystemInfo() {
    const api = getApiInstance();
    if (!api) throw new Error('API instance is not set');
    const result = await getSystemInfo(api);
    return {
      serverName: result.data?.ServerName,
      version: result.data?.Version,
      operatingSystem: result.data?.OperatingSystem,
    };
  }

  async getPublicUsers() {
    const api = getApiInstance();
    if (!api) throw new Error('API instance is not set');
    const result = await getPublicUsers(api);
    return (
      result.data?.map((user) => ({
        id: user.Id || '',
        name: user.Name || '',
        serverName: user.ServerName,
        avatar: user.PrimaryImageTag
          ? `${api.basePath}/Users/${user.Id}/Images/Primary?quality=90`
          : undefined,
      })) || []
    );
  }

  login({ username, password }: LoginParams) {
    const api = getApiInstance();
    if (!api) throw new Error('API instance is not set');
    return jfLogin(api, username, password);
  }

  authenticateAndSaveServer(params: AuthenticateAndSaveServerParams) {
    return authenticateAndSaveServer(
      params.address,
      params.username,
      params.password,
      params.addServer,
    );
  }

  async getLatestItems(params: GetLatestItemsParams) {
    const api = getApiInstance();
    if (!api) throw new Error('API instance is not set');
    const result = await getLatestItems(api, params.userId, params.limit, {
      includeItemTypes: params?.includeItemTypes
        ? convertItemTypesToJellyfin(params.includeItemTypes)
        : undefined,
      sortBy: params?.sortBy ? convertSortByToJellyfin(params.sortBy) : undefined,
      sortOrder: params?.sortOrder,
      year: params?.year,
      tags: params?.tags,
    });
    return {
      data: {
        Items: result.data?.Items?.map(convertBaseItemDtoToMediaItem),
      },
    };
  }

  async getLatestItemsByFolder({ userId, folderId, limit }: GetLatestItemsByFolderParams) {
    const api = getApiInstance();
    if (!api) throw new Error('API instance is not set');
    const result = await getLatestItemsByFolder(api, userId, folderId, limit);
    return {
      data: {
        Items: result.data?.map(convertBaseItemDtoToMediaItem),
      },
    };
  }

  async getNextUpItems({ userId, limit }: GetNextUpItemsParams) {
    const api = getApiInstance();
    if (!api) throw new Error('API instance is not set');
    const result = await getNextUpItems(api, userId, limit);
    return {
      data: {
        Items: result.data?.Items?.map(convertBaseItemDtoToMediaItem),
        TotalRecordCount: result.data?.TotalRecordCount,
      },
    };
  }

  async getNextUpItemsByFolder({ userId, folderId, limit }: GetNextUpItemsByFolderParams) {
    const api = getApiInstance();
    if (!api) throw new Error('API instance is not set');
    const result = await getNextUpItemsByFolder(api, userId, folderId, limit);
    return {
      data: {
        Items: result.data?.Items?.map(convertBaseItemDtoToMediaItem),
        TotalRecordCount: result.data?.TotalRecordCount,
      },
    };
  }

  async getResumeItems({ userId, limit }: GetResumeItemsParams) {
    const api = getApiInstance();
    if (!api) throw new Error('API instance is not set');
    const result = await getResumeItems(api, userId, limit);
    return {
      data: {
        Items: result.data?.Items?.map(convertBaseItemDtoToMediaItem),
        TotalRecordCount: result.data?.TotalRecordCount,
      },
    };
  }

  async getFavoriteItems({ userId, limit }: GetFavoriteItemsParams) {
    const api = getApiInstance();
    if (!api) throw new Error('API instance is not set');
    const result = await getFavoriteItems(api, userId, limit);
    return {
      data: {
        Items: result.data?.Items?.map(convertBaseItemDtoToMediaItem),
      },
    };
  }

  async getFavoriteItemsPaged({
    userId,
    startIndex,
    limit,
    includeItemTypes,
    sortBy,
    sortOrder,
    onlyUnplayed,
    year,
    tags,
  }: GetFavoriteItemsPagedParams) {
    const api = getApiInstance();
    if (!api) throw new Error('API instance is not set');
    const result = await getFavoriteItemsPaged(api, userId, startIndex, limit, {
      includeItemTypes: includeItemTypes ? convertItemTypesToJellyfin(includeItemTypes) : undefined,
      sortBy: sortBy ? convertSortByToJellyfin(sortBy) : undefined,
      sortOrder,
      onlyUnplayed,
      year,
      tags,
    });
    return {
      data: {
        Items: result.data?.Items?.map(convertBaseItemDtoToMediaItem),
        TotalRecordCount: result.data?.TotalRecordCount,
      },
    };
  }

  async logout() {
    const api = getApiInstance();
    if (!api) throw new Error('API instance is not set');
    await logout(api);
  }

  async getUserInfo({ userId }: GetUserInfoParams) {
    const api = getApiInstance();
    if (!api) throw new Error('API instance is not set');
    const result = await getUserInfo(api, userId);
    return {
      id: result.data?.Id || '',
      name: result.data?.Name || '',
      serverName: result.data?.ServerName,
      avatar: result.data?.PrimaryImageTag
        ? `${api.basePath}/Users/${userId}/Images/Primary?quality=90`
        : undefined,
    };
  }

  async getItemDetail({ itemId, userId }: GetItemDetailParams) {
    const api = getApiInstance();
    if (!api) throw new Error('API instance is not set');
    const result = await getItemDetail(api, itemId, userId);
    return convertBaseItemDtoToMediaItem(result.data!);
  }

  async getItemMediaSources({ itemId }: GetItemMediaSourcesParams) {
    const api = getApiInstance();
    if (!api) throw new Error('API instance is not set');
    const result = await getItemMediaSources(api, itemId);
    return {
      mediaSources:
        result.data?.MediaSources?.map((source) => ({
          id: source.Id || '',
          protocol: source.Protocol || '',
          container: source.Container || '',
          size: source.Size,
          bitrate: source.Bitrate,
          mediaStreams:
            source.MediaStreams?.map((stream) => ({
              codec: stream.Codec || '',
              type: (stream.Type as 'Video' | 'Audio' | 'Subtitle') || 'Video',
              index: stream.Index || 0,
              language: stream.Language,
              isDefault: stream.IsDefault,
              isForced: stream.IsForced,
              width: stream.Width,
              height: stream.Height,
              bitRate: stream.BitRate,
              // Video specific
              averageFrameRate: stream.AverageFrameRate,
              realFrameRate: stream.RealFrameRate,
              profile: stream.Profile,
              level: stream.Level,
              pixelFormat: stream.PixelFormat,
              bitDepth: stream.BitDepth,
              isInterlaced: stream.IsInterlaced,
              aspectRatio: stream.AspectRatio,
              videoRange: stream.VideoRange,
              // Audio specific
              channels: stream.Channels,
              channelLayout: stream.ChannelLayout,
              sampleRate: stream.SampleRate,
              title: stream.Title,
            })) || [],
        })) || [],
    };
  }

  async getUserView({ userId }: GetUserViewParams) {
    const api = getApiInstance();
    if (!api) throw new Error('API instance is not set');
    const result = await getUserView(api, userId);
    return result.data?.Items?.map(convertBaseItemDtoToMediaItem) || [];
  }

  async getAllItemsByFolder({
    userId,
    folderId,
    startIndex,
    limit,
    itemTypes,
    sortBy,
    sortOrder,
    onlyUnplayed,
    year,
    tags,
  }: GetAllItemsByFolderParams) {
    const api = getApiInstance();
    if (!api) throw new Error('API instance is not set');
    const result = await getAllItemsByFolder(
      api,
      userId,
      folderId,
      startIndex,
      limit,
      itemTypes ? convertItemTypesToJellyfin(itemTypes) : undefined,
      {
        sortBy: sortBy ? convertSortByToJellyfin(sortBy) : undefined,
        sortOrder,
        onlyUnplayed,
        year,
        tags,
      },
    );
    return {
      data: {
        Items: result.data?.Items?.map(convertBaseItemDtoToMediaItem),
        TotalRecordCount: result.data?.TotalRecordCount,
      },
    };
  }

  async getSeasonsBySeries({ seriesId, userId }: GetSeasonsBySeriesParams) {
    const api = getApiInstance();
    if (!api) throw new Error('API instance is not set');
    const result = await getSeasonsBySeries(api, seriesId, userId);
    return {
      data: {
        Items: result.data?.Items?.map(convertBaseItemDtoToMediaItem),
      },
    };
  }

  async getEpisodesBySeason({ seasonId, userId }: GetEpisodesBySeasonParams) {
    const api = getApiInstance();
    if (!api) throw new Error('API instance is not set');
    const result = await getEpisodesBySeason(api, seasonId, userId);
    return {
      data: {
        Items: result.data?.Items?.map(convertBaseItemDtoToMediaItem),
      },
    };
  }

  async getSimilarShows({ itemId, userId, limit }: GetSimilarShowsParams) {
    const api = getApiInstance();
    if (!api) throw new Error('API instance is not set');
    const result = await getSimilarShows(api, itemId, userId, limit);
    return {
      data: {
        Items: result.data?.Items?.map(convertBaseItemDtoToMediaItem),
      },
    };
  }

  async getSimilarMovies({ itemId, userId, limit }: GetSimilarMoviesParams) {
    const api = getApiInstance();
    if (!api) throw new Error('API instance is not set');
    const result = await getSimilarMovies(api, itemId, userId, limit);
    return {
      data: {
        Items: result.data?.Items?.map(convertBaseItemDtoToMediaItem),
      },
    };
  }

  async searchItems({ userId, searchTerm, limit, includeItemTypes }: SearchItemsParams) {
    const api = getApiInstance();
    if (!api) throw new Error('API instance is not set');
    const result = await searchItems(
      api,
      userId,
      searchTerm,
      limit,
      includeItemTypes ? convertItemTypesToJellyfin(includeItemTypes) : undefined,
    );
    return result.map(convertBaseItemDtoToMediaItem);
  }

  async getRecommendedSearchKeywords({ userId, limit }: GetRecommendedSearchKeywordsParams) {
    const api = getApiInstance();
    if (!api) throw new Error('API instance is not set');
    return getRecommendedSearchKeywords(api, userId, limit);
  }

  async getRandomItems(params: GetRandomItemsParams): Promise<MediaItem[]> {
    const api = getApiInstance();
    if (!api) throw new Error('API instance is not set');
    const result = await getRandomItems(api, params.userId, params.limit);
    return result.map(convertBaseItemDtoToMediaItem);
  }

  async getAvailableFilters({ userId, parentId }: GetAvailableFiltersParams) {
    const api = getApiInstance();
    if (!api) throw new Error('API instance is not set');
    const result = await getAvailableFilters(api, userId, parentId);
    return result;
  }

  getImageInfo({ item, opts }: GetImageInfoParams) {
    const baseItem = (item as MediaItem).raw ?? item;
    return getImageInfo(baseItem as BaseItemDto, opts);
  }

  async getStreamInfo({
    item,
    userId,
    startTimeTicks,
    maxStreamingBitrate,
    playSessionId,
    deviceProfile,
    audioStreamIndex,
    subtitleStreamIndex,
    height,
    mediaSourceId,
    deviceId,
    alwaysBurnInSubtitleWhenTranscoding,
  }: GetStreamInfoParams & { deviceProfile: DeviceProfile }) {
    const api = getApiInstance();
    if (!api) throw new Error('API instance is not set');
    return getStreamInfo({
      api,
      item: (item as MediaItem | null | undefined)?.raw as BaseItemDto,
      userId,
      startTimeTicks,
      maxStreamingBitrate,
      playSessionId,
      deviceProfile,
      audioStreamIndex,
      subtitleStreamIndex,
      height,
      mediaSourceId,
      deviceId,
      alwaysBurnInSubtitleWhenTranscoding,
    });
  }

  async addFavoriteItem({ userId, itemId }: UpdateFavoriteItemParams) {
    const api = getApiInstance();
    if (!api) throw new Error('API instance is not set');
    await addFavoriteItem(api, userId, itemId);
  }

  async removeFavoriteItem({ userId, itemId }: UpdateFavoriteItemParams) {
    const api = getApiInstance();
    if (!api) throw new Error('API instance is not set');
    await removeFavoriteItem(api, userId, itemId);
  }

  async markItemPlayed({ userId, itemId, datePlayed }: MarkItemPlayedParams) {
    const api = getApiInstance();
    if (!api) throw new Error('API instance is not set');
    await markItemPlayed(api, userId, itemId, datePlayed);
  }

  async markItemUnplayed({ userId, itemId }: UpdateFavoriteItemParams) {
    const api = getApiInstance();
    if (!api) throw new Error('API instance is not set');
    await markItemUnplayed(api, userId, itemId);
  }

  async reportPlaybackProgress({
    itemId,
    positionTicks,
    isPaused,
    PlaySessionId,
  }: ReportPlaybackProgressParams) {
    const api = getApiInstance();
    if (!api) throw new Error('API instance is not set');
    await reportPlaybackProgress(api, itemId, positionTicks, isPaused ?? false, PlaySessionId);
  }

  async reportPlaybackStart({ itemId, positionTicks, PlaySessionId }: ReportPlaybackStartParams) {
    const api = getApiInstance();
    if (!api) throw new Error('API instance is not set');
    await reportPlaybackStart(api, itemId, positionTicks ?? 0, PlaySessionId);
  }

  async reportPlaybackStop({ itemId, positionTicks, PlaySessionId }: ReportPlaybackStopParams) {
    const api = getApiInstance();
    if (!api) throw new Error('API instance is not set');
    await reportPlaybackStop(api, itemId, positionTicks, PlaySessionId);
  }
}

export const jellyfinAdapter = new JellyfinAdapter();
