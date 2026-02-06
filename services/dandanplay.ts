export type DandanSearchResult = {
  hasMore: boolean;
  animes: DandanAnime[];
  errorCode: number;
  success: boolean;
  errorMessage: string;
};

export type DandanAnime = {
  animeId: number;
  animeTitle: string;
  type: string;
  typeDescription: string;
  episodes: DandanEpisode[];
};

export type DandanEpisode = {
  episodeId: number;
  episodeTitle: string;
};

export type DandanCommentResult = {
  count: number;
  comments: {
    cid: number;
    p: string;
    m: string;
  }[];
};

export const DANDAN_COMMENT_MODE = {
  Bottom: 4,
  Top: 5,
  Scroll: 1,
  ScrollBottom: 6,
} as const;

export type DandanCommentMode = (typeof DANDAN_COMMENT_MODE)[keyof typeof DANDAN_COMMENT_MODE];

export type DandanComment = {
  id: number;
  timeInSeconds: number;
  text: string;
  colorHex: string;
  mode: DandanCommentMode;
  user: string;
};

async function makeRequest<T>(
  baseUrl: string,
  endpoint: string,
  params?: Record<string, any>,
): Promise<T> {
  if (!baseUrl) {
    throw new Error('未设置弹幕源地址');
  }

  const url = new URL(`${baseUrl}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, String(value));
    });
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export async function searchAnimesByKeyword(
  baseUrl: string,
  keyword: string,
): Promise<DandanAnime[]> {
  const res = await makeRequest<DandanSearchResult>(baseUrl, '/api/v2/search/episodes', {
    anime: keyword,
  });

  return res?.animes ?? [];
}

export async function searchEpisodesByKeyword(
  baseUrl: string,
  keyword: string,
): Promise<DandanEpisode[]> {
  const animes = await searchAnimesByKeyword(baseUrl, keyword);
  return (animes ?? []).flatMap((anime) => anime.episodes);
}

export async function getCommentsByEpisodeId(
  baseUrl: string,
  episodeId: number,
): Promise<DandanComment[]> {
  const res = await makeRequest<DandanCommentResult>(baseUrl, `/api/v2/comment/${episodeId}`, {
    withRelated: true,
    chConvert: 1,
    protect: 1,
  });

  const list = res?.comments ?? [];

  const normalize = (c: DandanCommentResult['comments'][number]): DandanComment | null => {
    if (!c || !c.p) return null;
    const parts = String(c.p).split(',');
    const timeInSeconds = parseFloat(parts[0] || '0') || 0;
    const mode = (parseInt(parts[1] || '1', 10) || 1) as DandanCommentMode;
    const colorNumber = parseInt(parts[2] || '16777215', 10) || 0xffffff;
    const colorHex = `#${colorNumber.toString(16).padStart(6, '0')}`;
    const text = String(c.m ?? '');
    if (!text) return null;

    // 提取用户信息用于过滤
    const user = parts[3] || '';

    return { id: c.cid, timeInSeconds, text, colorHex, mode, user };
  };

  return (Array.isArray(list) ? list : []).map(normalize).filter(Boolean) as DandanComment[];
}

export function groupCommentsBySecond(comments: DandanComment[]): Map<number, DandanComment[]> {
  const map = new Map<number, DandanComment[]>();
  for (const c of comments) {
    const second = Math.floor(c.timeInSeconds);
    const bucket = map.get(second);
    if (bucket) {
      bucket.push(c);
    } else {
      map.set(second, [c]);
    }
  }
  return map;
}