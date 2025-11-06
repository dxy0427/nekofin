import type { Api } from '@jellyfin/sdk';

import { embyAdapter, EmbyAdapter } from './emby/embyAdapter';
import { EmbyApi } from './emby/index';
import { jellyfinAdapter, JellyfinAdapter } from './jellyfin/jellyfinAdapter';
import type { MediaAdapter, MediaServerType } from './types';

export function getMediaAdapter(type: MediaServerType = 'jellyfin'): MediaAdapter {
  if (type === 'emby') return embyAdapter;
  return jellyfinAdapter;
}

export function createMediaAdapterWithApi(type: MediaServerType, api: Api | EmbyApi): MediaAdapter {
  if (type === 'emby') {
    const adapter = new EmbyAdapter();
    adapter.setApi(api as EmbyApi);
    return adapter;
  } else {
    const adapter = new JellyfinAdapter();
    adapter.setApi(api as Api);
    return adapter;
  }
}

export type { MediaAdapter, MediaServerType } from './types';
