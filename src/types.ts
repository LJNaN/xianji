// ---- Song 数据类型 ----

/** 后端 API 返回的歌曲数据 */
export interface SongFromApi {
  name: string;
  imgUrl?: string[];
  favorite?: boolean;
  createdAt?: string | null;
  frequency?: number;
}

/** 前端 Song 类型 */
export interface Song {
  id: string;
  name: string;
  imgUrl: string[];
  favorite: boolean;
  createdAt: string | null;
  frequency: number;
}

// ---- 组件类型 ----

export type ThemeMode = 'light' | 'dark' | 'system';

export type SortMode = 'frequency' | 'latest' | 'oldest' | 'nameAsc' | 'nameDesc' | 'parsed' | 'unparsed';

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
  /** 本次结果的来源在搜索结果里的下标 */
  index?: number;
  /** 本次搜索一共有多少个来源，用于判断还有没有下一个 */
  total?: number;
}

export interface SaveImagesResponse {
  message: string;
  count?: number;
  images?: string[];
}
