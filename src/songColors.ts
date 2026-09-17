// 歌曲按钮配色：主色相由设置决定（默认蓝），深浅由播放频率决定

export const DEFAULT_HUE = 210;

// 只给一组挑过的色相，不做自由取色：这套配色是「色相 + 感知亮度定标」，
// 任取一个颜色很容易配出浅色/深色主题下都不好看、或者字看不清的组合
export const HUE_PRESETS: { hue: number; label: string }[] = [
  { hue: 210, label: '蓝' },
  { hue: 185, label: '青' },
  { hue: 145, label: '绿' },
  { hue: 100, label: '草绿' },
  { hue: 45, label: '琥珀' },
  { hue: 12, label: '橙红' },
  { hue: 340, label: '粉' },
  { hue: 275, label: '紫' },
];

// 感知亮度目标区间（sRGB 相对亮度，0 黑 ~ 1 白）。
// 刻意收得很窄：文字颜色交给 antd 主题，浅色模式是黑字、深色模式是白字，
// 底色深了字就糊，所以最深一档也只到「明显能看出深浅」为止。
// 浅端一直贴到背景：没点过的歌压根不涂色（见 buildSongColorMap），
// 点过一两次的只留一层几乎看不见的色偏，往上才逐渐显出来
const LIGHT_LUM_PALE = 0.96;  // 点击最少
const LIGHT_LUM_DEEP = 0.6;   // 点击最多
const DARK_LUM_PALE = 0.012;
const DARK_LUM_DEEP = 0.1;

// 饱和度也跟着走：浅端低饱和，否则像米黄、青柠这类色相在同样亮度下
// 依然是一块看得见的色斑，浅端就白得不够干净
const LIGHT_SAT_PALE = 28;
const LIGHT_SAT_DEEP = 55;
const DARK_SAT_PALE = 12;
const DARK_SAT_DEEP = 40;

export interface SongColor {
  lightBg: string;
  darkBg: string;
}

function channel(v: number): number {
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/** sRGB 相对亮度，0（黑）~ 1（白） */
function luminance(hue: number, sat: number, lightness: number): number {
  const s = sat / 100;
  const l = lightness / 100;
  const k = (n: number) => (n + hue / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return 0.2126 * channel(f(0)) + 0.7152 * channel(f(8)) + 0.0722 * channel(f(4));
}

/**
 * 二分求「目标相对亮度」对应的 HSL 明度。
 * 直接用 HSL 明度当深浅是错的：同样 57% 明度，黄色比蓝色亮得多，
 * 按色相定亮度的结果就是黄色底配浅字糊成一片。这里统一按感知亮度定标。
 */
function lightnessFor(hue: number, sat: number, target: number): number {
  let lo = 0;
  let hi = 100;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (luminance(hue, sat, mid) < target) lo = mid;
    else hi = mid;
  }
  return Math.round(((lo + hi) / 2) * 10) / 10;
}

/** t = 频率在全体歌曲里的相对高低，0 最低、1 最高 */
export function songColor(hue: number, t: number): SongColor {
  const lightSat = LIGHT_SAT_PALE + t * (LIGHT_SAT_DEEP - LIGHT_SAT_PALE);
  const darkSat = DARK_SAT_PALE + t * (DARK_SAT_DEEP - DARK_SAT_PALE);
  return {
    lightBg: `hsl(${hue} ${lightSat}% ${lightnessFor(hue, lightSat, LIGHT_LUM_PALE - t * (LIGHT_LUM_PALE - LIGHT_LUM_DEEP))}%)`,
    darkBg: `hsl(${hue} ${darkSat}% ${lightnessFor(hue, darkSat, DARK_LUM_PALE + t * (DARK_LUM_DEEP - DARK_LUM_PALE))}%)`,
  };
}

export interface SongPanel {
  lightBg: string;
  lightBorder: string;
  lightText: string;
  darkBg: string;
  darkBorder: string;
  darkText: string;
}

/**
 * 「最爱」面板这类容器块的配色：浅底 + 稍重描边 + 可读的标题色。
 * 用的还是同一套色相和亮度定标，所以换主题色时整块面板跟着按钮一起变，
 * 不会只剩面板还停在写死的粉色上。
 * 底色刻意比歌曲按钮更淡：它是整块背景，压深了会盖掉里面按钮的层次
 */
export function songPanel(hue: number): SongPanel {
  return {
    lightBg: `hsl(${hue} 30% ${lightnessFor(hue, 30, 0.93)}%)`,
    lightBorder: `hsl(${hue} 45% ${lightnessFor(hue, 45, 0.72)}%)`,
    lightText: `hsl(${hue} 65% ${lightnessFor(hue, 65, 0.12)}%)`,
    darkBg: `hsl(${hue} 14% ${lightnessFor(hue, 14, 0.02)}%)`,
    darkBorder: `hsl(${hue} 20% ${lightnessFor(hue, 20, 0.055)}%)`,
    darkText: `hsl(${hue} 70% ${lightnessFor(hue, 70, 0.35)}%)`,
  };
}

/**
 * 频率 → 0..1（1 为最高频）。
 * 按去重后的频率值排名分布，而不是按 min/max 线性插值：
 * 否则一首 42 次的歌会把其余 0~2 次的歌全挤到最浅的一档，看不出差别。
 */
export function buildSongColorMap(songs: { name: string; frequency: number }[], hue: number): Map<string, SongColor> {
  // 0 次不进排名：没点过的歌干脆不上色，保持按钮默认样子，
  // 这样「一次都没点过」和「点过几次」之间是一条清晰的界线
  const levels = [...new Set(songs.map(s => s.frequency))].filter(f => f > 0).sort((a, b) => a - b);
  const last = levels.length - 1;
  const ratio = new Map<number, number>();
  // 只有一个档位时全部按最浅处理：此时所有歌并列「点击最少」，
  // 若按最高处理会把整页涂成最深一档，又丑又费眼
  levels.forEach((f, i) => ratio.set(f, last <= 0 ? 0 : i / last));

  const map = new Map<string, SongColor>();
  for (const song of songs) {
    const t = ratio.get(song.frequency);
    if (t === undefined) continue;
    map.set(song.name, songColor(hue, t));
  }
  return map;
}
