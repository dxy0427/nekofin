import { MediaItemType, MediaSortBy, MediaSortOrder } from '@/services/media/types';
import { useState } from 'react';

export type MediaFilters = {
  includeItemTypes?: MediaItemType[];
  sortBy?: MediaSortBy[];
  sortOrder?: MediaSortOrder;
  onlyUnplayed?: boolean;
  year?: number;
  tags?: string[];
};

export function createDefaultFilters(overrides?: Partial<MediaFilters>): MediaFilters {
  return {
    // 修复：加入 BoxSet (合集) 和 Season (季度)，确保收藏夹中能显示这些内容
    includeItemTypes: ['Movie', 'Series', 'Episode', 'BoxSet', 'Season'],
    sortBy: ['DateCreated'],
    sortOrder: 'Descending',
    onlyUnplayed: false,
    year: undefined,
    tags: undefined,
    ...overrides,
  };
}

export function useMediaFilters(initial?: Partial<MediaFilters>) {
  const [filters, setFilters] = useState<MediaFilters>(createDefaultFilters(initial));
  return { filters, setFilters };
}