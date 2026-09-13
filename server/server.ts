import path from 'path';
import fs from 'fs';

// 若 .env 不存在则自动创建模板
const envPath = path.join(__dirname, '..', '.env');
if (!fs.existsSync(envPath)) {
  fs.writeFileSync(envPath, '# DeepSeek API Key（AI 搜索功能，可前往 https://platform.deepseek.com/ 获取）\nDEEPSEEK_KEY=sk-your-key-here\n', 'utf-8');
  console.log('[startup] .env 不存在，已创建模板');
}

import dotenv from 'dotenv';
dotenv.config({ path: envPath });

import express, { Request, Response } from 'express';
import multer from 'multer';
import cors from 'cors';
import axios from 'axios';
import * as cheerio from 'cheerio';
import crypto from 'crypto';
import db, { SongRow } from './db';

const app = express();
const PORT = process.env.PORT || 5000;
const IMAGE_DIR = path.join(__dirname, 'images');

// 前端 SongFromApi 类型（与后端 row 结构解耦）
interface SongFromApi {
  name: string;
  imgUrl: string[];
  favorite: boolean;
  createdAt: string | null;
}

// ---- JSON → SQLite 迁移 ----
const DATA_FILE = path.join(__dirname, 'song_list.json');
const VISITS_FILE = path.join(__dirname, 'visits.json');

if (fs.existsSync(DATA_FILE)) {
  const count = (db.prepare('SELECT COUNT(*) as count FROM songs').get() as { count: number }).count;
  if (count === 0) {
    const songs: any[] = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    const insert = db.prepare('INSERT OR IGNORE INTO songs (name, img_url, favorite, created_at, sort_order) VALUES (?, ?, ?, ?, ?)');
    const tx = db.transaction((songs: any[]) => {
      for (let i = 0; i < songs.length; i++) {
        const s = songs[i];
        insert.run(s.name, JSON.stringify(s.imgUrl || []), s.favorite ? 1 : 0, s.createdAt || null, i);
      }
    });
    tx(songs);
    console.log('[migrate] song_list.json → SQLite 迁移完成');
  } else {
    console.log('[migrate] songs 表已有数据，跳过迁移');
  }
  fs.renameSync(DATA_FILE, path.join(path.dirname(DATA_FILE), '.' + path.basename(DATA_FILE) + '.bak'));
}

if (fs.existsSync(VISITS_FILE)) {
  const count = (db.prepare('SELECT COUNT(*) as count FROM visits').get() as { count: number }).count;
  if (count === 0) {
    const visits: any[] = JSON.parse(fs.readFileSync(VISITS_FILE, 'utf-8'));
    const insert = db.prepare('INSERT INTO visits (date, time, uuid, ip, user_agent) VALUES (?, ?, ?, ?, ?)');
    const tx = db.transaction((visits: any[]) => {
      for (const v of visits) {
        insert.run(v.date, v.time, v.uuid, v.ip || null, v.userAgent || null);
      }
    });
    tx(visits);
    console.log('[migrate] visits.json → SQLite 迁移完成');
  } else {
    console.log('[migrate] visits 表已有数据，跳过迁移');
  }
  fs.renameSync(VISITS_FILE, path.join(path.dirname(VISITS_FILE), '.' + path.basename(VISITS_FILE) + '.bak'));
}

// 清理超过 30 天的访问记录
const purged = db.prepare("DELETE FROM visits WHERE date < date('now', '-30 days')").run();
if (purged.changes > 0) {
  console.log(`[startup] 已清理 ${purged.changes} 条超过 30 天的访问记录`);
}

// ---- Middleware ----
app.use(cors());
app.use(express.json());
app.use('/guitar-images', express.static(IMAGE_DIR));

// ---- 图片代理 ----
app.get('/guitar-api/proxy-image', async (req: Request, res: Response) => {
  const url = req.query.url as string | undefined;
  if (!url) return res.status(400).end();
  try {
    const resp = await axios.get(url, {
      responseType: 'stream',
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
        'Referer': new URL(url).origin + '/',
      }
    });
    res.set('Content-Type', resp.headers['content-type'] as string);
    resp.data.pipe(res);
  } catch (e) {
    res.status(500).end();
  }
});

fs.mkdirSync(IMAGE_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: IMAGE_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, crypto.randomUUID() + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(path.extname(file.originalname).toLowerCase());
    cb(ok ? null : new Error('不支持的文件格式'), ok);
  }
});

// ---- 数据转换 ----
function rowToSong(row: SongRow | undefined): SongFromApi | null {
  if (!row) return null;
  return {
    name: row.name,
    imgUrl: JSON.parse(row.img_url),
    favorite: !!row.favorite,
    createdAt: row.created_at,
  };
}

function getAllSongs(): SongFromApi[] {
  return (db.prepare('SELECT * FROM songs ORDER BY sort_order').all() as SongRow[]).map(rowToSong);
}

function getSongByName(name: string): SongFromApi | null {
  return rowToSong(db.prepare('SELECT * FROM songs WHERE name = ?').get(name) as SongRow | undefined);
}

// ---- Songs CRUD ----

app.get('/guitar-api/songs', (_req: Request, res: Response) => {
  res.json(getAllSongs());
});

app.post('/guitar-api/songs', (req: Request, res: Response) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: '歌曲名称不能为空' });
  const existing = db.prepare('SELECT name FROM songs WHERE name = ?').get(name) as { name: string } | undefined;
  if (existing) return res.status(409).json({ error: '歌曲已存在' });
  const nextOrder = (db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS v FROM songs').get() as { v: number }).v;
  db.prepare('INSERT INTO songs (name, img_url, favorite, created_at, sort_order) VALUES (?, ?, ?, ?, ?)').run(name, '[]', 0, new Date().toISOString(), nextOrder);
  res.status(201).json({ message: '歌曲创建成功', song: getSongByName(name) });
});

app.delete('/guitar-api/songs/:name', (req: Request, res: Response) => {
  const { name } = req.params;
  const result = db.prepare('DELETE FROM songs WHERE name = ?').run(name);
  if (result.changes === 0) return res.status(404).json({ error: '歌曲未找到' });
  res.json({ message: '歌曲删除成功' });
});

app.put('/guitar-api/songs/:name/favorite', (req: Request, res: Response) => {
  const { name } = req.params;
  const row = db.prepare('SELECT favorite FROM songs WHERE name = ?').get(name) as { favorite: number } | undefined;
  if (!row) return res.status(404).json({ error: '歌曲未找到' });
  const newVal = row.favorite ? 0 : 1;
  db.prepare('UPDATE songs SET favorite = ? WHERE name = ?').run(newVal, name);
  res.json({ message: '更新成功', favorite: !!newVal });
});

app.put('/guitar-api/songs/:old_name', (req: Request, res: Response) => {
  const { old_name } = req.params;
  const newName = (req.body.name || '').trim();
  if (!newName) return res.status(400).json({ error: '新歌曲名称不能为空' });
  const target = db.prepare('SELECT name FROM songs WHERE name = ?').get(old_name) as { name: string } | undefined;
  if (!target) return res.status(404).json({ error: '原歌曲未找到' });
  const conflict = db.prepare('SELECT name FROM songs WHERE name = ? AND name != ?').get(newName, old_name) as { name: string } | undefined;
  if (conflict) return res.status(409).json({ error: '新歌曲名称已存在' });
  db.prepare('UPDATE songs SET name = ? WHERE name = ?').run(newName, old_name);
  res.json({ message: '歌曲重命名成功', song: getSongByName(newName) });
});

app.post('/guitar-api/songs/reorder', (req: Request, res: Response) => {
  const { song_names } = req.body;
  if (!Array.isArray(song_names)) return res.status(400).json({ error: 'song_names 必须是数组' });
  const all = db.prepare('SELECT name FROM songs').all() as { name: string }[];
  const nameSet = new Set(all.map(r => r.name));
  for (const n of song_names) {
    if (!nameSet.has(n)) return res.status(400).json({ error: `歌曲 '${n}' 不存在` });
  }
  const update = db.prepare('UPDATE songs SET sort_order = ? WHERE name = ?');
  db.transaction((names: string[]) => { for (let i = 0; i < names.length; i++) update.run(i, names[i]); })(song_names);
  res.json({ message: '歌单排序更新成功' });
});

// ---- 图片下载 ----

async function downloadImage(url: string, index: number): Promise<string | null> {
  try {
    const resp = await axios.get(url, {
      timeout: 10000,
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': new URL(url).origin + '/',
      }
    });
    const ct = resp.headers['content-type'] as string || '';
    const ext = ct.includes('png') ? '.png' : ct.includes('gif') ? '.gif' : ct.includes('webp') ? '.webp' : '.jpg';
    const baseName = crypto.randomUUID();
    let filename = `${baseName}${ext}`;
    let filepath = path.join(IMAGE_DIR, filename);
    let counter = 1;
    while (fs.existsSync(filepath)) {
      filename = `${baseName}_${index}_${counter}${ext}`;
      filepath = path.join(IMAGE_DIR, filename);
      counter++;
    }
    const writer = fs.createWriteStream(filepath);
    resp.data.pipe(writer);
    await new Promise<void>((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
    return `/guitar-images/${filename}`;
  } catch (e) {
    console.error(`下载失败 ${url}:`, (e as Error).message);
    return null;
  }
}

async function searchBingResults(query: string, maxResults = 3): Promise<string[]> {
  const url = `https://cn.bing.com/search?q=${encodeURIComponent(query)}`;
  const resp = await axios.get(url, {
    timeout: 10000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'zh-CN,zh;q=0.9',
    }
  });
  const $ = cheerio.load(resp.data);
  const links: string[] = [];
  $('#b_results .b_algo h2 a').each((_, el) => {
    const href = $(el).attr('href');
    if (href) links.push(href);
  });
  return links.slice(0, maxResults);
}

async function parseImagesFromUrl(url: string): Promise<{ type: string; data: string[] }> {
  const resp = await axios.get(url, {
    timeout: 20000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
      'Referer': new URL(url).origin + '/',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'zh-CN,zh;q=0.9',
    }
  });
  const $ = cheerio.load(resp.data);
  const urls = new Set<string>();

  $('img').each((_, el) => {
    const src = $(el).attr('data-original') || $(el).attr('src') || '';
    if (!src || src.includes('data:image') || src.includes('lazy.png')) return;
    const fullUrl = new URL(src, url).href;
    if (/\.(jpe?g|png|gif|webp)/i.test(fullUrl)) {
      urls.add(fullUrl);
    }
  });

  return { type: 'image', data: [...urls].slice(0, 10) };
}

// ---- Tabs / 吉他谱 ----

app.post('/guitar-api/tabs/:title', async (req: Request, res: Response) => {
  const { title } = req.params;
  const { url } = req.body as { url?: string };
  if (!url) return res.status(400).json({ error: '缺少 url 参数' });
  let row = db.prepare('SELECT * FROM songs WHERE name = ?').get(title) as SongRow | undefined;
  if (!row) {
    const nextOrder = (db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS v FROM songs').get() as { v: number }).v;
    db.prepare('INSERT INTO songs (name, sort_order) VALUES (?, ?)').run(title, nextOrder);
  }
  try {
    const result = await parseImagesFromUrl(url);
    if (result && result.type === 'image' && result.data && result.data.length > 0) {
      res.json({ candidate_images: result.data });
    } else {
      res.status(404).json({ error: '未从该页面提取到图片' });
    }
  } catch (e) {
    res.status(500).json({ error: `解析失败: ${(e as Error).message}` });
  }
});

app.post('/guitar-api/tabs/:name/auto-fetch', async (req: Request, res: Response) => {
  const { name } = req.params;
  const ATTEMPT_TIMEOUT = 5000;
  const MAX_ATTEMPTS = 5;
  const TOTAL_TIMEOUT = 30000;

  try {
    const resultUrls = await searchBingResults(`${name}吉他谱`, MAX_ATTEMPTS);
    if (!resultUrls || resultUrls.length === 0) {
      return res.status(404).json({ error: '未在 Bing 搜索到相关结果' });
    }

    const startTime = Date.now();
    const attemptLogs: Array<{ url: string; error: string }> = [];

    for (let i = 0; i < resultUrls.length; i++) {
      if (Date.now() - startTime > TOTAL_TIMEOUT) {
        attemptLogs.push({ url: resultUrls[i], error: '总超时 30 秒，跳过' });
        break;
      }

      if (i > 0) await new Promise(r => setTimeout(r, 1000));

      console.log(`[auto-fetch] 正在尝试 (${i + 1}/${resultUrls.length}): ${resultUrls[i]}`);

      try {
        const result: { type: string; data: string[] } = await Promise.race([
          parseImagesFromUrl(resultUrls[i]),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('超时(5s)')), ATTEMPT_TIMEOUT))
        ]);

        if (result && result.type === 'image' && result.data && result.data.length > 0) {
          console.log(`[auto-fetch] ✓ 成功: ${resultUrls[i]} (${result.data.length} 张图片)`);
          return res.json({ source_url: resultUrls[i], candidate_images: result.data });
        }
        const msg = '未提取到图片';
        console.log(`[auto-fetch] ✗ ${resultUrls[i]} — ${msg}`);
        attemptLogs.push({ url: resultUrls[i], error: msg });
      } catch (e) {
        const msg = (e as Error).message;
        console.log(`[auto-fetch] ✗ ${resultUrls[i]} — ${msg}`);
        attemptLogs.push({ url: resultUrls[i], error: msg });
      }
    }

    console.log(`[auto-fetch] 所有尝试均失败 (${attemptLogs.length} 个)`);
    res.status(404).json({
      error: `已尝试 ${attemptLogs.length} 个搜索结果，均失败`,
      details: attemptLogs,
    });
  } catch (e) {
    res.status(500).json({ error: `自动获取失败: ${(e as Error).message}` });
  }
});

function deleteOldImages(oldUrls: string[]) {
  for (const url of oldUrls) {
    if (url.startsWith('/guitar-images/')) {
      const filename = path.basename(url);
      const filepath = path.join(IMAGE_DIR, filename);
      fs.unlink(filepath, (err) => {
        if (err && (err as NodeJS.ErrnoException).code !== 'ENOENT') console.error('删除旧图片失败:', filepath, err.message);
      });
    }
  }
}

app.post('/guitar-api/tabs/:name/save', async (req: Request, res: Response) => {
  const { name } = req.params;
  const { images, mode } = req.body as { images?: string[]; mode?: string };
  if (!Array.isArray(images)) return res.status(400).json({ error: 'images 必须是数组' });
  const row = db.prepare('SELECT * FROM songs WHERE name = ?').get(name) as SongRow | undefined;
  if (!row) return res.status(404).json({ error: '歌曲未找到' });

  if (mode === 'reorder') {
    db.prepare('UPDATE songs SET img_url = ? WHERE name = ?').run(JSON.stringify(images), name);
    return res.json({ message: '顺序已更新' });
  }

  const oldUrls: string[] = JSON.parse(row.img_url);
  deleteOldImages(oldUrls);

  const localUrls: string[] = [];
  for (let i = 0; i < images.length; i++) {
    const local = await downloadImage(images[i], i + 1);
    if (local) localUrls.push(local);
  }

  const hadImages = oldUrls.length > 0;
  const createdAt = (!hadImages && localUrls.length > 0) ? new Date().toISOString() : row.created_at;
  db.prepare('UPDATE songs SET img_url = ?, created_at = ? WHERE name = ?').run(JSON.stringify(localUrls), createdAt, name);
  res.json({ message: '保存成功', count: localUrls.length });
});

app.put('/guitar-api/tabs/:name/images', (req: Request, res: Response) => {
  const { name } = req.params;
  const { images } = req.body as { images?: string[] };
  if (!Array.isArray(images)) return res.status(400).json({ error: 'images 必须是数组' });
  const row = db.prepare('SELECT name FROM songs WHERE name = ?').get(name) as { name: string } | undefined;
  if (!row) return res.status(404).json({ error: '歌曲未找到' });
  db.prepare('UPDATE songs SET img_url = ? WHERE name = ?').run(JSON.stringify(images), name);
  res.json({ message: '图片更新成功', count: images.length });
});

app.post('/guitar-api/tabs/:name/reparse', async (req: Request, res: Response) => {
  const { name } = req.params;
  const { url } = req.body as { url?: string };
  if (!url) return res.status(400).json({ error: 'URL 不能为空' });
  let row = db.prepare('SELECT * FROM songs WHERE name = ?').get(name) as SongRow | undefined;
  if (!row) {
    const nextOrder = (db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS v FROM songs').get() as { v: number }).v;
    db.prepare('INSERT INTO songs (name, sort_order) VALUES (?, ?)').run(name, nextOrder);
  }
  try {
    const result = await parseImagesFromUrl(url);
    if (result && result.type === 'image' && result.data && result.data.length > 0) {
      res.json({ candidate_images: result.data });
    } else {
      res.status(404).json({ error: '未从该页面提取到图片' });
    }
  } catch (e) {
    res.status(500).json({ error: `解析失败: ${(e as Error).message}` });
  }
});

app.post('/guitar-api/tabs/:name/upload', upload.array('images', 10), async (req: Request, res: Response) => {
  const { name } = req.params;
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) return res.status(400).json({ error: '未上传文件' });
  const row = db.prepare('SELECT * FROM songs WHERE name = ?').get(name) as SongRow | undefined;
  if (!row) return res.status(404).json({ error: '歌曲未找到' });
  const paths = files.map(f => `/guitar-images/${f.filename}`);
  const existing: string[] = JSON.parse(row.img_url);
  db.prepare('UPDATE songs SET img_url = ? WHERE name = ?').run(JSON.stringify([...existing, ...paths]), name);
  res.json({ message: '上传成功', count: paths.length, images: paths });
});

// ---- AI 搜索 ----

app.post('/guitar-api/ai-search', async (req: Request, res: Response) => {
  const DEEPSEEK_KEY = process.env.DEEPSEEK_KEY;
  if (!DEEPSEEK_KEY) return res.status(500).json({ error: 'AI 搜索未配置（缺少 DEEPSEEK_KEY）' });

  const { searchTerm, songNames } = req.body as { searchTerm?: string; songNames?: string[] };
  if (!searchTerm || !Array.isArray(songNames)) return res.status(400).json({ error: '参数错误' });

  try {
    const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
      model: 'deepseek-flash',
      thinking: { type: "disabled" },
      messages: [
        { role: 'system', content: `用户搜索了吉他谱关键词。可用的歌曲有：${songNames.join('、')}。从歌曲列表中找出最匹配的，按相关度排序，只返回 JSON 数组` },
        { role: 'user', content: searchTerm },
      ],
      temperature: 0.1,
      max_tokens: 5000,
    }, {
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_KEY}` },
      timeout: 15000,
    });

    res.json(response.data);
  } catch (err) {
    console.error('AI search error:', (err as Error).message);
    res.status(502).json({ error: 'AI 搜索失败' });
  }
});

// ---- 访问记录 ----

app.post('/guitar-api/visit', (req: Request, res: Response) => {
  const { uuid, userAgent } = req.body as { uuid?: string; userAgent?: string };
  if (!uuid) return res.status(400).json({ error: '缺少 uuid' });

  db.prepare('INSERT INTO visits (date, time, uuid, ip, user_agent) VALUES (?, ?, ?, ?, ?)').run(
    new Date().toISOString().slice(0, 10),
    new Date().toISOString(),
    uuid,
    (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() || req.ip,
    userAgent || '',
  );

  res.json({ ok: true });
});

// ---- 静态文件 ----

const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req: Request, res: Response) => {
    if (!req.path.startsWith('/guitar-api/')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`吉他谱 API 服务运行在 http://0.0.0.0:${PORT}`);
});
