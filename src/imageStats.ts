// 从像素上判断一张图「明显不是谱」，用来把候选图里的 logo / 头像 / 专辑封面 /
// 深色照片这类垃圾先筛掉。阈值是量出来的，不是拍的：拿 271 张人工攒下来的真谱做正样本，
// 近白像素占比最低的一张是 0.679、像素量最低的一张是 0.55MP；而候选池里
// 彩色 logo、歌手照片、封面图、二维码这些垃圾全部远低于这两条线。
//
// 阈值刻意压得比边界低（0.55 / 0.4MP），只砍最明显的一档：
// 白底的二维码、灰底头像占位图、App 界面截图这些也会「像谱」，但它们留在结果里
// 由人一眼扫过去，比误杀一张真谱的代价小得多。所以这里宁可漏，不可错杀，
// 并且在界面上留了「显示全部」的退路。

/** 缩到这么大再统计，够用且快 */
const SAMPLE_LONG_SIDE = 160;

/** 近白像素占比的下限 */
const MIN_WHITE_RATIO = 0.55;

/** 像素量下限，挡掉小图标和缩略图 */
const MIN_MEGAPIXELS = 0.4;

/** 判定为「近白」的灰度值（0~255） */
const WHITE_LUM = 220;

/**
 * 判断一张已加载完的图是否「明显不是谱」。
 * 拿不到像素时返回 null（量不了就不下结论，调用方按保留处理）。
 */
export function isObviousJunk(img: HTMLImageElement): boolean | null {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) return null;
  if (w * h < MIN_MEGAPIXELS * 1e6) return true;

  const scale = Math.min(1, SAMPLE_LONG_SIDE / Math.max(w, h));
  const sw = Math.max(1, Math.round(w * scale));
  const sh = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  try {
    ctx.drawImage(img, 0, 0, sw, sh);
    const { data } = ctx.getImageData(0, 0, sw, sh);
    let white = 0;
    for (let i = 0; i < data.length; i += 4) {
      if ((data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000 >= WHITE_LUM) white++;
    }
    return white / (sw * sh) < MIN_WHITE_RATIO;
  } catch {
    // 取不到像素（理论上同源不会发生）就当没量到
    return null;
  }
}

/**
 * 逐个加载并判断，返回其中「明显不是谱」的 URL。
 * 图片本来就是同源代理来的、显示时也要下载，所以这里不额外多花流量
 * （代理那边带了缓存头，正式渲染时会命中缓存）。
 *
 * 加载失败、超时、量不出来的一律留在结果里：宁可多显示一张垃圾，
 * 也不能因为图片没加载出来就把真谱藏了。
 */
export async function screenImages(
  urls: string[],
  srcOf: (url: string) => string,
  timeoutMs = 4000
): Promise<string[]> {
  const flags = await Promise.all(urls.map(url => new Promise<boolean>(resolve => {
    let settled = false;
    const finish = (junk: boolean) => {
      if (settled) return;
      settled = true;
      resolve(junk);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    const img = new Image();
    img.onload = () => {
      clearTimeout(timer);
      try {
        finish(isObviousJunk(img) === true);
      } catch {
        finish(false);
      }
    };
    img.onerror = () => {
      clearTimeout(timer);
      finish(false);
    };
    img.src = srcOf(url);
  })));

  return urls.filter((_, i) => flags[i]);
}
