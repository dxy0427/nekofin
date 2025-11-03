import createApiClient, { ApiClient, ApiResponse } from '@/lib/request';
import { getDeviceId } from '@/lib/utils';
import { BaseItemDto, ItemSortBy } from '@jellyfin/sdk/lib/generated-client';
import { RecommendedServerInfo } from '@jellyfin/sdk/lib/models/recommended-server-info';

import { convertBaseItemDtoToMediaItem } from '../jellyfin/jellyfinAdapter';
import { MediaItem, MediaPerson, MediaSortBy } from '../types';

export type EmbyApi = {
  basePath: string;
  accessToken: string | null;
};

export type EmbyPublicSystemInfo = {
  ServerName?: string;
  Version?: string;
  OperatingSystem?: string;
};

export type EmbyPublicUser = {
  Id?: string;
  Name?: string;
  ServerName?: string;
  PrimaryImageTag?: string;
};

export type EmbyAuthenticateResponse = {
  User?: { Id?: string; Name?: string };
  AccessToken?: string;
};

export type EmbyPlaybackInfoMediaStream = {
  Codec?: string;
  Type?: 'Video' | 'Audio' | 'Subtitle';
  Index?: number;
  Language?: string;
  IsDefault?: boolean;
  IsForced?: boolean;
  Width?: number;
  Height?: number;
  BitRate?: number;
  // Video specific
  AverageFrameRate?: number;
  RealFrameRate?: number;
  Profile?: string;
  Level?: number;
  PixelFormat?: string;
  BitDepth?: number;
  IsInterlaced?: boolean;
  AspectRatio?: string;
  VideoRange?: string;
  // Audio specific
  Channels?: number;
  ChannelLayout?: string;
  SampleRate?: number;
  Title?: string;
};

export type EmbyPlaybackInfoMediaSource = {
  Id?: string;
  Protocol?: string;
  Container?: string;
  Size?: number;
  Bitrate?: number;
  MediaStreams?: EmbyPlaybackInfoMediaStream[];
  TranscodingUrl?: string;
};

export type EmbyPlaybackInfoResponse = {
  PlaySessionId?: string;
  MediaSources?: EmbyPlaybackInfoMediaSource[];
};

export type EmbyFiltersResponse = { Years?: number[]; Tags?: string[]; Genres?: string[] };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isBaseItemDto(value: unknown): value is BaseItemDto {
  return isRecord(value) && 'Id' in value;
}

export function toRecommendedServerInfo(address: string, name: string): RecommendedServerInfo {
  return { Address: address, Id: 'emby', Name: name } as unknown as RecommendedServerInfo;
}

export function getUnderlyingRaw(item: MediaItem | MediaPerson): unknown {
  return 'raw' in (item as MediaItem) ? ((item as MediaItem).raw ?? item) : item;
}

export function getBlurHash(itemData: BaseItemDto, imageType: string): string | undefined {
  const hashes = itemData.ImageBlurHashes;
  if (!hashes) return undefined;
  const value = hashes[imageType as keyof typeof hashes];
  return typeof value === 'string' ? value : undefined;
}

let apiInstance: EmbyApi | null = null;
let apiClient: ApiClient | null = null;

export function getApiInstance(): EmbyApi | null {
  return apiInstance;
}

export function setGlobalApiInstance(api: EmbyApi | null): void {
  apiInstance = api;
}

export function ensureApi(): EmbyApi {
  if (!apiInstance) throw new Error('API instance not set');
  return apiInstance;
}

export function setToken(token: string | null) {
  if (apiInstance) apiInstance.accessToken = token;
}

export function rebuildApiClient() {
  const api = ensureApi();
  apiClient = createApiClient({ baseUrl: api.basePath });
  apiClient.addRequestInterceptor((config) => {
    const currentApi = ensureApi();
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'X-Emby-Client': 'Nekofin',
      'X-Emby-Device-Name': 'Nekofin Device',
      'X-Emby-Device-Id': getDeviceId(),
      'X-Emby-Client-Version': '1.0.0',
      'X-Emby-Language': 'zh-cn',
      ...(config.headers as Record<string, string> | undefined),
    };
    if (currentApi.accessToken) headers['X-Emby-Token'] = currentApi.accessToken;
    return { ...config, headers };
  });
  apiClient.addResponseInterceptor(async (response) => {
    if (!response.ok) return response;

    const text = await response.text();
    if (!text.trim()) {
      const wrapped: ApiResponse<unknown> = { code: 200, data: null, msg: 'ok' };
      return wrapped as ApiResponse<unknown>;
    }

    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch (error) {
      console.error('Failed to parse JSON response:', error);
      const wrapped: ApiResponse<unknown> = { code: 200, data: null, msg: 'ok' };
      return wrapped as ApiResponse<unknown>;
    }

    const wrapped: ApiResponse<unknown> = { code: 200, data, msg: 'ok' };
    return wrapped as ApiResponse<unknown>;
  });
}

export function ensureClient() {
  if (!apiClient) rebuildApiClient();
  return apiClient as NonNullable<typeof apiClient>;
}

export function getEmbyApiClient(): ApiClient {
  return ensureClient();
}

export function setIfDefined(
  params: URLSearchParams,
  key: string,
  value: string | number | boolean | null | undefined,
) {
  if (value === undefined || value === null) return;
  params.set(key, String(value));
}

export function setListIfNotEmpty(
  params: URLSearchParams,
  key: string,
  arr: (string | number)[] | undefined,
) {
  if (!arr || arr.length === 0) return;
  params.set(key, arr.join(','));
}

export function applyDefaultImageAndFields(params: URLSearchParams, fields?: string) {
  params.set(
    'Fields',
    fields || 'BasicSyncInfo,CanDelete,PrimaryImageAspectRatio,ProductionYear,Status,EndDate,Path',
  );
  params.set('ImageTypeLimit', '1');
  params.set('EnableImageTypes', 'Primary,Backdrop,Thumb');
}

export async function parseItems(
  res: ApiResponse<{ Items?: BaseItemDto[] }> | { Items?: BaseItemDto[] },
): Promise<MediaItem[]> {
  const payload =
    'code' in (res as ApiResponse<unknown>)
      ? (res as ApiResponse<{ Items?: BaseItemDto[] }>).data
      : (res as { Items?: BaseItemDto[] });
  return payload.Items?.map(convertBaseItemDtoToMediaItem) || [];
}

export async function parseItemsWithCount(
  res:
    | ApiResponse<{ Items?: BaseItemDto[]; TotalRecordCount?: number }>
    | { Items?: BaseItemDto[]; TotalRecordCount?: number },
): Promise<{ Items?: MediaItem[]; TotalRecordCount?: number }> {
  const payload =
    'code' in (res as ApiResponse<unknown>)
      ? (res as ApiResponse<{ Items?: BaseItemDto[]; TotalRecordCount?: number }>).data
      : (res as { Items?: BaseItemDto[]; TotalRecordCount?: number });
  return {
    Items: payload.Items?.map(convertBaseItemDtoToMediaItem),
    TotalRecordCount: payload.TotalRecordCount,
  };
}

export function convertSortByToEmby(sortBy: MediaSortBy[]): ItemSortBy[] {
  return sortBy.map((sb) => sb as ItemSortBy);
}
