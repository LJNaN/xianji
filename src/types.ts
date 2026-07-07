// ---- Song 数据类型 ----

/** 后端 API 返回的歌曲数据 */
export interface SongFromApi {
  name: string;
  imgUrl?: string[];
  favorite?: boolean;
  createdAt?: string | null;
}

/** 前端 Song 类型 */
export interface Song {
  id: string;
  name: string;
  imgUrl: string[];
  favorite: boolean;
  createdAt: string | null;
}

// ---- 组件类型 ----

export type ThemeMode = 'light' | 'dark' | 'system';

export type SortMode = 'latest' | 'oldest' | 'nameAsc' | 'nameDesc' | 'parsed' | 'unparsed';

// ---- API 响应类型 ----

export interface AiSearchResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

export interface AutoFetchResponse {
  source_url?: string;
  candidate_images?: string[];
  error?: string;
  details?: Array<{ url: string; error: string }>;
}

export interface SaveImagesResponse {
  message: string;
  count?: number;
  images?: string[];
}
