import type { ImageUrlInfo } from '@/lib/utils/image';
import { CardShapes, getShapeFromItemType, isPerson } from '@/lib/utils/items';
import type { RecommendedServerInfo } from '@jellyfin/sdk';
import { BaseItemDto, BaseItemKind, ImageType } from '@jellyfin/sdk/lib/generated-client/models';

import {
  applyDefaultImageAndFields,
  convertSortByToEmby,
  createEmbyApiClient,
  EmbyApi,
  EmbyAuthenticateResponse,
  EmbyPlaybackInfoResponse,
  EmbyPublicSystemInfo,
  EmbyPublicUser,
  ensureApi,
  getApiInstance,
  getBlurHash,
  getEmbyApiClient,
  getUnderlyingRaw,
  isBaseItemDto,
  parseItems,
  parseItemsWithCount,
  rebuildApiClient,
  setGlobalApiInstance,
  setToken,
  toRecommendedServerInfo,
} from '.';
import { StreamInfo } from '../jellyfin';
import { convertBaseItemDtoToMediaItem } from '../jellyfin/jellyfinAdapter';
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
  type MediaFilters,
  type MediaItem,
  type MediaPlaybackInfo,
  type MediaServerInfo,
  type MediaSystemInfo,
  type MediaUser,
  type ReportPlaybackProgressParams,
  type ReportPlaybackStartParams,
  type ReportPlaybackStopParams,
  type SearchItemsParams,
  type UpdateFavoriteItemParams,
} from '../types';

export class EmbyAdapter implements MediaAdapter {
  _api: EmbyApi | null = null;

  getApiInstance(): EmbyApi | null {
    return getApiInstance();
  }

  setGlobalApiInstance(api: EmbyApi | null): void {
    setGlobalApiInstance(api);
  }

  setApi(api: EmbyApi | null): void {
    this._api = api;
  }

  getApi(): EmbyApi | null {
    return this._api || this.getApiInstance();
  }

  async discoverServers({ host }: DiscoverServersParams): Promise<RecommendedServerInfo[]> {
    const address = host.replace(/\/$/, '');
    const res = await fetch(`${address}/System/Info/Public`);
    if (!res.ok) return [];
    const data = (await res.json()) as { ServerName?: string };
    return [toRecommendedServerInfo(address, data?.ServerName || address)];
  }

  findBestServer({ servers }: FindBestServerParams): RecommendedServerInfo | null {
    return servers?.[0] ?? null;
  }

  createApi({ address }: CreateApiParams): EmbyApi {
    const basePath = address.replace(/\/$/, '');
    const apiInstance = { basePath, accessToken: null };
    setGlobalApiInstance(apiInstance);
    rebuildApiClient();
    return apiInstance;
  }

  createApiFromServerInfo({ serverInfo }: CreateApiFromServerInfoParams): EmbyApi {
    const basePath = serverInfo.address.replace(/\/$/, '');
    const apiInstance = { basePath, accessToken: serverInfo.accessToken };
    setGlobalApiInstance(apiInstance);
    rebuildApiClient();
    return apiInstance;
  }

  async getSystemInfo(): Promise<MediaSystemInfo> {
    const res = await getEmbyApiClient().get<EmbyPublicSystemInfo>(`/System/Info/Public`);
    const result = res.data;
    return {
      serverName: result?.ServerName,
      version: result?.Version,
      operatingSystem: result?.OperatingSystem,
    };
  }

  async getPublicUsers(): Promise<MediaUser[]> {
    const api = ensureApi();
    const res = await getEmbyApiClient().get<EmbyPublicUser[]>(`/Users/Public`);
    const data = res.data;
    return (data || []).map((user) => ({
      id: user.Id || '',
      name: user.Name || '',
      serverName: user.ServerName,
      avatar: user.PrimaryImageTag
        ? `${api.basePath}/Users/${user.Id}/Images/Primary?quality=90`
        : undefined,
    }));
  }

  async login({ username, password }: LoginParams): Promise<{ data: EmbyAuthenticateResponse }> {
    const client = getEmbyApiClient();
    const res = await client.post<EmbyAuthenticateResponse>(
      '/Users/AuthenticateByName',
      { Username: username, Pw: password },
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );
    const data = res.data;
    if (data?.AccessToken) setToken(data.AccessToken);
    return { data };
  }

  async authenticateAndSaveServer({
    address,
    username,
    password,
    addServer,
  }: AuthenticateAndSaveServerParams): Promise<unknown> {
    this.createApi({ address });
    const loginRes = await this.login({ username, password });
    const token = loginRes?.data?.AccessToken;
    const userId = loginRes?.data?.User?.Id;
    if (userId && token) {
      const normalizedAddress = address.replace(/\/$/, '');
      const sys = await this.getSystemInfo();
      const serverInfo: Omit<MediaServerInfo, 'id' | 'createdAt'> = {
        address: normalizedAddress,
        name: sys.serverName || normalizedAddress,
        userId: userId,
        username: loginRes.data?.User?.Name || username,
        userAvatar: `${normalizedAddress}/Users/${userId}/Images/Primary?quality=90`,
        accessToken: token,
        type: 'emby',
      };
      await addServer(serverInfo);
      return loginRes;
    }
    throw new Error('Authentication failed');
  }

  async getLatestItems({
    userId,
    limit,
    includeItemTypes,
    sortBy,
    sortOrder,
    year,
    tags,
  }: GetLatestItemsParams): Promise<{ data: { Items?: MediaItem[]; TotalRecordCount?: number } }> {
    const baseParams = new URLSearchParams();
    applyDefaultImageAndFields(baseParams);
    const res = await getEmbyApiClient().get<{
      Items?: BaseItemDto[];
      TotalRecordCount?: number;
    }>(`/Users/${userId}/Items`, {
      UserId: userId,
      Recursive: true,
      Filters: 'IsNotFolder',
      Limit: limit,
      IncludeItemTypes: includeItemTypes?.join(','),
      SortBy: convertSortByToEmby(sortBy || []).join(','),
      SortOrder: sortOrder,
      Years: year,
      Tags: tags?.join(','),
      ...Object.fromEntries(baseParams.entries()),
    });
    const data = await parseItemsWithCount(res);
    return { data };
  }

  async getLatestItemsByFolder({ userId, folderId, limit }: GetLatestItemsByFolderParams): Promise<{
    data: { Items?: MediaItem[]; TotalRecordCount?: number };
  }> {
    const res = await getEmbyApiClient().get<BaseItemDto[]>(`/Users/${userId}/Items/Latest`, {
      Limit: limit,
      ParentId: folderId,
      ...(() => {
        const p = new URLSearchParams();
        applyDefaultImageAndFields(p);
        return Object.fromEntries(p.entries());
      })(),
    });
    const items = await parseItems({ Items: res.data });
    return { data: { Items: items } };
  }

  async getNextUpItems({ userId, limit }: GetNextUpItemsParams): Promise<{
    data: { Items?: MediaItem[]; TotalRecordCount?: number };
  }> {
    const res = await getEmbyApiClient().get<{ Items?: BaseItemDto[]; TotalRecordCount?: number }>(
      `/Shows/NextUp`,
      {
        Limit: limit,
        UserId: userId,
        Fields: 'PrimaryImageAspectRatio,DateCreated,MediaSourceCount',
        ImageTypeLimit: 1,
        EnableImageTypes: 'Primary,Backdrop,Banner,Thumb',
      },
    );
    const data = await parseItemsWithCount(res);
    return { data };
  }

  async getNextUpItemsByFolder({ userId, folderId, limit }: GetNextUpItemsByFolderParams): Promise<{
    data: { Items?: MediaItem[]; TotalRecordCount?: number };
  }> {
    const res = await getEmbyApiClient().get<{ Items?: BaseItemDto[]; TotalRecordCount?: number }>(
      `/Shows/NextUp`,
      {
        Limit: limit,
        UserId: userId,
        ParentId: folderId,
      },
    );
    const data = await parseItemsWithCount(res);
    return { data };
  }

  async getResumeItems({ userId, limit }: GetResumeItemsParams): Promise<{
    data: { Items?: MediaItem[]; TotalRecordCount?: number };
  }> {
    const res = await getEmbyApiClient().get<{ Items?: BaseItemDto[]; TotalRecordCount?: number }>(
      `/Users/${userId}/Items/Resume`,
      {
        Recursive: true,
        Fields: 'BasicSyncInfo,CanDelete,PrimaryImageAspectRatio,ProductionYear',
        ImageTypeLimit: 1,
        EnableImageTypes: 'Primary,Backdrop,Thumb',
        MediaTypes: 'Video',
        Limit: limit,
      },
    );
    const data = await parseItemsWithCount(res);
    return { data };
  }

  async getFavoriteItems({ userId, limit }: GetFavoriteItemsParams): Promise<{
    data: { Items?: MediaItem[]; TotalRecordCount?: number };
  }> {
    const baseParams = new URLSearchParams();
    applyDefaultImageAndFields(baseParams);
    const res = await getEmbyApiClient().get<{ Items?: BaseItemDto[] }>(`/Users/${userId}/Items`, {
      UserId: userId,
      Recursive: true,
      Filters: 'IsFavorite',
      Limit: limit,
      IncludeItemTypes: 'Movie,Series,Episode',
      SortBy: 'DateCreated',
      SortOrder: 'Descending',
      ...Object.fromEntries(baseParams.entries()),
    });
    const items = await parseItems(res);
    return { data: { Items: items } };
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
  }: GetFavoriteItemsPagedParams): Promise<{
    data: { Items?: MediaItem[]; TotalRecordCount?: number };
  }> {
    const baseParams = new URLSearchParams();
    applyDefaultImageAndFields(baseParams);
    const res = await getEmbyApiClient().get<{ Items?: BaseItemDto[]; TotalRecordCount?: number }>(
      `/Users/${userId}/Items`,
      {
        UserId: userId,
        StartIndex: startIndex,
        Limit: limit,
        Recursive: true,
        Filters: onlyUnplayed ? 'IsFavorite,IsUnplayed' : 'IsFavorite',
        IncludeItemTypes: includeItemTypes?.join(','),
        SortBy: convertSortByToEmby(sortBy || []).join(','),
        SortOrder: sortOrder,
        Years: year,
        Tags: tags?.join(','),
        ...Object.fromEntries(baseParams.entries()),
      },
    );
    const data = await parseItemsWithCount(res);
    return { data };
  }

  async logout(): Promise<void> {
    setToken(null);
  }

  async getUserInfo({ userId }: GetUserInfoParams): Promise<MediaUser> {
    const api = ensureApi();
    const res = await getEmbyApiClient().get<EmbyPublicUser>(`/Users/${userId}`);
    const result = res.data;
    return {
      id: result?.Id || '',
      name: result?.Name || '',
      serverName: result?.ServerName,
      avatar: result?.PrimaryImageTag
        ? `${api.basePath}/Users/${userId}/Images/Primary?quality=90`
        : undefined,
    };
  }

  async getItemDetail({ itemId, userId }: GetItemDetailParams): Promise<MediaItem> {
    const res = await getEmbyApiClient().get<BaseItemDto>(`/Users/${userId}/Items/${itemId}`);
    const data = res.data;
    return convertBaseItemDtoToMediaItem(data);
  }

  async getItemMediaSources({ itemId }: GetItemMediaSourcesParams): Promise<MediaPlaybackInfo> {
    const res = await getEmbyApiClient().post<EmbyPlaybackInfoResponse>(
      `/Items/${itemId}/PlaybackInfo`,
      {
        IsPlayback: true,
        AutoOpenLiveStream: true,
      },
    );
    const result = res.data;
    return {
      mediaSources:
        result.MediaSources?.map((source) => ({
          id: source.Id || '',
          protocol: source.Protocol || '',
          container: source.Container || '',
          size: source.Size,
          bitrate: source.Bitrate,
          mediaStreams:
            source.MediaStreams?.map((stream) => ({
              codec: stream.Codec || '',
              type: stream.Type === 'Audio' || stream.Type === 'Subtitle' ? stream.Type : 'Video',
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

  async getUserView({ userId }: GetUserViewParams): Promise<MediaItem[]> {
    const api = this.getApi();
    const client = api ? createEmbyApiClient(api) : getEmbyApiClient();
    const res = await client.get<{ Items?: BaseItemDto[] }>(`/Users/${userId}/Views`);
    return await parseItems(res);
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
  }: GetAllItemsByFolderParams): Promise<{
    data: { Items?: MediaItem[]; TotalRecordCount?: number };
  }> {
    const baseParams = new URLSearchParams();
    applyDefaultImageAndFields(baseParams);
    const res = await getEmbyApiClient().get<{ Items?: BaseItemDto[]; TotalRecordCount?: number }>(
      `/Users/${userId}/Items`,
      {
        UserId: userId,
        ParentId: folderId,
        Recursive: true,
        StartIndex: startIndex,
        Limit: limit,
        IncludeItemTypes: itemTypes?.join(','),
        SortBy: convertSortByToEmby(sortBy || []).join(','),
        SortOrder: sortOrder,
        Filters: onlyUnplayed ? 'IsUnplayed' : undefined,
        Years: year,
        Tags: tags?.join(','),
        ...Object.fromEntries(baseParams.entries()),
      },
    );
    const data = await parseItemsWithCount(res);
    return { data };
  }

  async getSeasonsBySeries({ seriesId, userId }: GetSeasonsBySeriesParams): Promise<{
    data: { Items?: MediaItem[] };
  }> {
    const res = await getEmbyApiClient().get<{ Items?: BaseItemDto[] }>(`/Users/${userId}/Items`, {
      UserId: userId,
      ParentId: seriesId,
      IncludeItemTypes: 'Season',
      Recursive: false,
      SortBy: 'IndexNumber',
      SortOrder: 'Ascending',
      Fields: 'PrimaryImageAspectRatio',
      ImageTypeLimit: 1,
      EnableImageTypes: 'Primary,Backdrop,Thumb',
    });
    const items = await parseItems(res);
    return { data: { Items: items } };
  }

  async getEpisodesBySeason({ seasonId, userId }: GetEpisodesBySeasonParams): Promise<{
    data: { Items?: MediaItem[] };
  }> {
    const res = await getEmbyApiClient().get<{ Items?: BaseItemDto[] }>(`/Users/${userId}/Items`, {
      UserId: userId,
      ParentId: seasonId,
      IncludeItemTypes: 'Episode',
      Fields: 'ItemCounts,PrimaryImageAspectRatio,CanDelete,MediaSourceCount,Overview',
    });
    const items = await parseItems(res);
    return { data: { Items: items } };
  }

  async getSimilarShows({
    itemId,
    userId,
    limit,
  }: GetSimilarShowsParams): Promise<{ data: { Items?: MediaItem[] } }> {
    const res = await getEmbyApiClient().get<{ Items?: BaseItemDto[] }>(
      `/Items/${itemId}/Similar`,
      {
        Limit: limit,
        UserId: userId,
        IncludeItemTypes: 'Series',
        Fields: 'PrimaryImageAspectRatio',
      },
    );
    const items = await parseItems(res);
    return { data: { Items: items } };
  }

  async getSimilarMovies({
    itemId,
    userId,
    limit,
  }: GetSimilarMoviesParams): Promise<{ data: { Items?: MediaItem[] } }> {
    const res = await getEmbyApiClient().get<{ Items?: BaseItemDto[] }>(
      `/Items/${itemId}/Similar`,
      {
        Limit: limit,
        UserId: userId,
        IncludeItemTypes: 'Movie',
        Fields: 'PrimaryImageAspectRatio',
      },
    );
    const items = await parseItems(res);
    return { data: { Items: items } };
  }

  async searchItems({
    userId,
    searchTerm,
    limit,
    includeItemTypes,
  }: SearchItemsParams): Promise<MediaItem[]> {
    const res = await getEmbyApiClient().get<{ Items?: BaseItemDto[] }>(`/Users/${userId}/Items`, {
      UserId: userId,
      Recursive: true,
      SearchTerm: searchTerm,
      SortBy: 'SortName',
      SortOrder: 'Ascending',
      Fields: 'PrimaryImageAspectRatio',
      ImageTypeLimit: 1,
      EnableImageTypes: 'Primary,Backdrop,Thumb',
      Limit: limit,
      IncludeItemTypes: includeItemTypes?.join(','),
    });
    return await parseItems(res);
  }

  async getRecommendedSearchKeywords({
    userId,
    limit,
  }: GetRecommendedSearchKeywordsParams): Promise<string[]> {
    const res = await getEmbyApiClient().get<{ Items?: { Name?: string }[] }>(
      `/Users/${userId}/Items`,
      {
        UserId: userId,
        Recursive: true,
        IncludeItemTypes: 'Movie,Series,MusicArtist',
        SortBy: 'IsFavoriteOrLiked,Random',
        ImageTypeLimit: 0,
        EnableTotalRecordCount: false,
        EnableImages: false,
        Limit: limit,
      },
    );
    const data = res.data;
    const titles = (data.Items ?? []).map((i) => i.Name).filter((v): v is string => Boolean(v));
    return Array.from(new Set(titles)).slice(0, limit ?? 20);
  }

  async getRandomItems({ userId, limit }: GetRandomItemsParams): Promise<MediaItem[]> {
    const baseParams = new URLSearchParams();
    applyDefaultImageAndFields(
      baseParams,
      'BasicSyncInfo,CanDelete,PrimaryImageAspectRatio,ProductionYear,Status,EndDate,Path,ParentId',
    );
    const res = await getEmbyApiClient().get<{ Items?: BaseItemDto[] }>(`/Users/${userId}/Items`, {
      UserId: userId,
      Recursive: true,
      IncludeItemTypes: 'Movie,Series',
      SortBy: 'Random',
      Limit: limit,
      ...Object.fromEntries(baseParams.entries()),
    });
    return await parseItems(res);
  }

  async getAvailableFilters({
    userId,
    parentId,
  }: GetAvailableFiltersParams): Promise<MediaFilters> {
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 10 }, (_, i) => currentYear - i);
    return {
      years,
      tags: [],
      genres: [],
    };
  }

  getImageInfo({ item, opts }: GetImageInfoParams): ImageUrlInfo {
    const api = ensureApi();
    const baseItemCandidate = getUnderlyingRaw(item);

    if (!isBaseItemDto(baseItemCandidate)) {
      return { url: undefined, blurhash: undefined };
    }

    const { preferBackdrop, preferBanner, preferLogo, preferThumb, width } = opts ?? {};
    const inheritThumb = true;
    const tag = '';

    const itemData = baseItemCandidate;

    let imgType: string = 'Primary';
    let imgTag;
    let itemId: string | null | undefined = itemData.Id;
    let height;

    const shape = isPerson(itemData) ? CardShapes.Portrait : getShapeFromItemType(itemData.Type);

    if (tag && preferBackdrop) {
      imgType = ImageType.Backdrop;
      imgTag = tag;
    } else if (tag && preferBanner) {
      imgType = ImageType.Banner;
      imgTag = tag;
    } else if (tag && preferLogo) {
      imgType = ImageType.Logo;
      imgTag = tag;
    } else if (tag && preferThumb) {
      imgType = ImageType.Thumb;
      imgTag = tag;
    } else if (tag) {
      imgType = ImageType.Primary;
      imgTag = tag;
    } else if (isPerson(itemData)) {
      imgType = ImageType.Primary;
      imgTag = itemData.PrimaryImageTag;
    } else if (preferThumb && itemData.ImageTags?.Thumb) {
      imgType = ImageType.Thumb;
      imgTag = itemData.ImageTags.Thumb;
    } else if ((preferBanner || shape === CardShapes.Banner) && itemData.ImageTags?.Banner) {
      imgType = ImageType.Banner;
      imgTag = itemData.ImageTags.Banner;
    } else if (preferLogo && itemData.ImageTags?.Logo) {
      imgType = ImageType.Logo;
      imgTag = itemData.ImageTags.Logo;
    } else if (preferBackdrop && itemData.BackdropImageTags?.[0]) {
      imgType = ImageType.Backdrop;
      imgTag = itemData.BackdropImageTags[0];
    } else if (preferLogo && itemData.ParentLogoImageTag && itemData.ParentLogoItemId) {
      imgType = ImageType.Logo;
      imgTag = itemData.ParentLogoImageTag;
      itemId = itemData.ParentLogoItemId;
    } else if (
      preferBackdrop &&
      itemData.ParentBackdropImageTags?.[0] &&
      itemData.ParentBackdropItemId
    ) {
      imgType = ImageType.Backdrop;
      imgTag = itemData.ParentBackdropImageTags[0];
      itemId = itemData.ParentBackdropItemId;
    } else if (preferThumb && itemData.SeriesThumbImageTag && inheritThumb) {
      imgType = ImageType.Thumb;
      imgTag = itemData.SeriesThumbImageTag;
      itemId = itemData.SeriesId;
    } else if (
      preferThumb &&
      itemData.ParentThumbItemId &&
      inheritThumb &&
      itemData.MediaType !== 'Photo'
    ) {
      imgType = ImageType.Thumb;
      imgTag = itemData.ParentThumbImageTag;
      itemId = itemData.ParentThumbItemId;
    } else if (preferThumb && itemData.BackdropImageTags?.length) {
      imgType = ImageType.Backdrop;
      imgTag = itemData.BackdropImageTags[0];
    } else if (
      preferThumb &&
      itemData.ParentBackdropImageTags?.length &&
      inheritThumb &&
      itemData.Type === BaseItemKind.Episode
    ) {
      imgType = ImageType.Backdrop;
      imgTag = itemData.ParentBackdropImageTags[0];
      itemId = itemData.ParentBackdropItemId;
    } else if (
      itemData.ImageTags?.Primary &&
      (itemData.Type !== BaseItemKind.Episode || itemData.ChildCount !== 0)
    ) {
      imgType = ImageType.Primary;
      imgTag = itemData.ImageTags.Primary;
      height =
        width && itemData.PrimaryImageAspectRatio
          ? Math.round(width / itemData.PrimaryImageAspectRatio)
          : undefined;
    } else if (itemData.SeriesPrimaryImageTag) {
      imgType = ImageType.Primary;
      imgTag = itemData.SeriesPrimaryImageTag;
      itemId = itemData.SeriesId;
    } else if (itemData.ParentPrimaryImageTag) {
      imgType = ImageType.Primary;
      imgTag = itemData.ParentPrimaryImageTag;
      itemId = itemData.ParentPrimaryImageItemId;
    } else if (itemData.AlbumId && itemData.AlbumPrimaryImageTag) {
      imgType = ImageType.Primary;
      imgTag = itemData.AlbumPrimaryImageTag;
      itemId = itemData.AlbumId;
      height =
        width && itemData.PrimaryImageAspectRatio
          ? Math.round(width / itemData.PrimaryImageAspectRatio)
          : undefined;
    } else if (itemData.Type === BaseItemKind.Season && itemData.ImageTags?.Thumb) {
      imgType = ImageType.Thumb;
      imgTag = itemData.ImageTags.Thumb;
    } else if (itemData.BackdropImageTags?.length) {
      imgType = ImageType.Backdrop;
      imgTag = itemData.BackdropImageTags[0];
    } else if (itemData.ImageTags?.Thumb) {
      imgType = ImageType.Thumb;
      imgTag = itemData.ImageTags.Thumb;
    } else if (itemData.SeriesThumbImageTag && inheritThumb) {
      imgType = ImageType.Thumb;
      imgTag = itemData.SeriesThumbImageTag;
      itemId = itemData.SeriesId;
    } else if (itemData.ParentThumbItemId && inheritThumb) {
      imgType = ImageType.Thumb;
      imgTag = itemData.ParentThumbImageTag;
      itemId = itemData.ParentThumbItemId;
    } else if (itemData.ParentBackdropImageTags?.length && inheritThumb) {
      imgType = ImageType.Backdrop;
      imgTag = itemData.ParentBackdropImageTags[0];
      itemId = itemData.ParentBackdropItemId;
    }

    if (!imgTag) {
      return { url: undefined, blurhash: undefined };
    }

    const params = new URLSearchParams();
    params.set('tag', imgTag);
    if (opts?.width) params.set('maxWidth', String(opts.width));
    if (opts?.height) params.set('maxHeight', String(opts.height));
    params.set('quality', '90');

    const url = `${api.basePath}/Items/${itemId}/Images/${imgType}?${params.toString()}`;

    const blurhash = getBlurHash(itemData, imgType);

    return {
      url,
      blurhash,
    };
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
  }: GetStreamInfoParams): Promise<StreamInfo | null> {
    const api = ensureApi();
    const rawCandidate = (item as MediaItem | null | undefined)?.raw ?? null;
    const baseItem = isBaseItemDto(rawCandidate) ? rawCandidate : null;
    if (!userId || !baseItem?.Id) return null;

    const res = await getEmbyApiClient().post(`/Items/${baseItem.Id}/PlaybackInfo`, {
      UserId: userId,
      DeviceProfile: deviceProfile,
      SubtitleStreamIndex: subtitleStreamIndex,
      StartTimeTicks: startTimeTicks,
      IsPlayback: true,
      AutoOpenLiveStream: true,
      MaxStreamingBitrate: maxStreamingBitrate,
      AudioStreamIndex: audioStreamIndex,
      MediaSourceId: mediaSourceId,
    });
    const playback = res.data as {
      PlaySessionId?: string;
      MediaSources?: { Id?: string; TranscodingUrl?: string }[];
    };
    const mediaSource = playback.MediaSources?.[0];
    const sessionId = playback.PlaySessionId || null;

    let url: string | null = null;
    if (mediaSource?.TranscodingUrl) {
      url = `${api.basePath}${mediaSource.TranscodingUrl}`;
    } else {
      const qs = new URLSearchParams();
      qs.set('static', 'true');
      qs.set('container', 'mp4');
      qs.set('mediaSourceId', mediaSource?.Id || '');
      if (typeof subtitleStreamIndex === 'number')
        qs.set('subtitleStreamIndex', String(subtitleStreamIndex));
      if (typeof audioStreamIndex === 'number')
        qs.set('audioStreamIndex', String(audioStreamIndex));
      if (deviceId) qs.set('deviceId', deviceId);
      if (api.accessToken) qs.set('api_key', api.accessToken);
      qs.set('startTimeTicks', String(startTimeTicks || 0));
      if (maxStreamingBitrate) qs.set('maxStreamingBitrate', String(maxStreamingBitrate));
      qs.set('userId', userId);
      if (playSessionId) qs.set('playSessionId', playSessionId);
      url = `${api.basePath}/Videos/${baseItem.Id}/stream?${qs.toString()}`;
    }

    return { url, sessionId, mediaSource: undefined };
  }

  async addFavoriteItem({ userId, itemId }: UpdateFavoriteItemParams): Promise<void> {
    await getEmbyApiClient().post(`/Users/${userId}/FavoriteItems/${itemId}`);
  }

  async removeFavoriteItem({ userId, itemId }: UpdateFavoriteItemParams): Promise<void> {
    await getEmbyApiClient().delete(`/Users/${userId}/FavoriteItems/${itemId}`);
  }

  async markItemPlayed({ userId, itemId, datePlayed }: MarkItemPlayedParams): Promise<void> {
    const qs = new URLSearchParams();
    if (datePlayed) qs.set('DatePlayed', datePlayed);
    await getEmbyApiClient().post(`/Users/${userId}/PlayedItems/${itemId}?${qs.toString()}`);
  }

  async markItemUnplayed({ userId, itemId }: UpdateFavoriteItemParams): Promise<void> {
    await getEmbyApiClient().delete(`/Users/${userId}/PlayedItems/${itemId}`);
  }

  async reportPlaybackProgress({
    itemId,
    positionTicks,
    isPaused,
    PlaySessionId,
  }: ReportPlaybackProgressParams): Promise<void> {
    await getEmbyApiClient().post(`/emby/Sessions/Playing/Progress`, {
      ItemId: itemId,
      PositionTicks: Math.floor(positionTicks * 10000),
      IsPaused: isPaused ?? false,
      CanSeek: true,
      PlaybackStartTimeTicks: Date.now() * 10000,
      PlaySessionId,
    });
  }

  async reportPlaybackStart({
    itemId,
    positionTicks,
    PlaySessionId,
  }: ReportPlaybackStartParams): Promise<void> {
    await getEmbyApiClient().post(`/emby/Sessions/Playing`, {
      ItemId: itemId,
      PositionTicks: Math.floor((positionTicks ?? 0) * 10000),
      CanSeek: true,
      PlaybackStartTimeTicks: Date.now() * 10000,
      PlaySessionId,
    });
  }

  async reportPlaybackStop({
    itemId,
    positionTicks,
    PlaySessionId,
  }: ReportPlaybackStopParams): Promise<void> {
    await getEmbyApiClient().post(`/emby/Sessions/Playing/Stopped`, {
      ItemId: itemId,
      PositionTicks: Math.floor(positionTicks * 10000),
      PlaySessionId,
    });
  }
}

export const embyAdapter = new EmbyAdapter();