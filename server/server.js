// 若 .env 不存在则自动创建模板
const envPath = require('path').join(__dirname, '..', '.env');
if (!require('fs').existsSync(envPath)) {
  require('fs').writeFileSync(envPath, '# DeepSeek API Key（AI 搜索功能，可前往 https://platform.deepseek.com/ 获取）\nDEEPSEEK_KEY=sk-your-key-here\n', 'utf-8');
  console.log('[startup] .env 不存在，已创建模板');
}
require('dotenv').config({ path: envPath });

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;
const IMAGE_DIR = path.join(__dirname, 'images');

// ---- JSON → SQLite 迁移 ----
const DATA_FILE = path.join(__dirname, 'song_list.json');
const VISITS_FILE = path.join(__dirname, 'visits.json');

if (fs.existsSync(DATA_FILE)) {
  const count = db.prepare('SELECT COUNT(*) as count FROM songs').get().count;
  if (count === 0) {
    const songs = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    const insert = db.prepare('INSERT OR IGNORE INTO songs (name, img_url, favorite, created_at, sort_order) VALUES (?, ?, ?, ?, ?)');
    const tx = db.transaction((songs) => {
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
  const count = db.prepare('SELECT COUNT(*) as count FROM visits').get().count;
  if (count === 0) {
    const visits = JSON.parse(fs.readFileSync(VISITS_FILE, 'utf-8'));
    const insert = db.prepare('INSERT INTO visits (date, time, uuid, ip, user_agent) VALUES (?, ?, ?, ?, ?)');
    const tx = db.transaction((visits) => {
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
app.get('/guitar-api/proxy-image', async (req, res) => {
  const { url } = req.query;
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
    res.set('Content-Type', resp.headers['content-type']);
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
function rowToSong(row) {
  if (!row) return null;
  const song = { name: row.name, imgUrl: JSON.parse(row.img_url), favorite: !!row.favorite };
  if (row.created_at) song.createdAt = row.created_at;
  return song;
}

function getAllSongs() {
  return db.prepare('SELECT * FROM songs ORDER BY sort_order').all().map(rowToSong);
}

function getSongByName(name) {
  return rowToSong(db.prepare('SELECT * FROM songs WHERE name = ?').get(name));
}

// ---- Songs CRUD ----

app.get('/guitar-api/songs', (req, res) => {
  res.json(getAllSongs());
});

app.post('/guitar-api/songs', (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: '歌曲名称不能为空' });
  const existing = db.prepare('SELECT name FROM songs WHERE name = ?').get(name);
  if (existing) return res.status(409).json({ error: '歌曲已存在' });
  const nextOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS v FROM songs').get().v;
  db.prepare('INSERT INTO songs (name, img_url, favorite, created_at, sort_order) VALUES (?, ?, ?, ?, ?)').run(name, '[]', 0, new Date().toISOString(), nextOrder);
  res.status(201).json({ message: '歌曲创建成功', song: getSongByName(name) });
});

app.delete('/guitar-api/songs/:name', (req, res) => {
  const { name } = req.params;
  const result = db.prepare('DELETE FROM songs WHERE name = ?').run(name);
  if (result.changes === 0) return res.status(404).json({ error: '歌曲未找到' });
  res.json({ message: '歌曲删除成功' });
});

app.put('/guitar-api/songs/:name/favorite', (req, res) => {
  const { name } = req.params;
  const row = db.prepare('SELECT favorite FROM songs WHERE name = ?').get(name);
  if (!row) return res.status(404).json({ error: '歌曲未找到' });
  const newVal = row.favorite ? 0 : 1;
  db.prepare('UPDATE songs SET favorite = ? WHERE name = ?').run(newVal, name);
  res.json({ message: '更新成功', favorite: !!newVal });
});

app.put('/guitar-api/songs/:old_name', (req, res) => {
  const { old_name } = req.params;
  const newName = (req.body.name || '').trim();
  if (!newName) return res.status(400).json({ error: '新歌曲名称不能为空' });
  const target = db.prepare('SELECT name FROM songs WHERE name = ?').get(old_name);
  if (!target) return res.status(404).json({ error: '原歌曲未找到' });
  const conflict = db.prepare('SELECT name FROM songs WHERE name = ? AND name != ?').get(newName, old_name);
  if (conflict) return res.status(409).json({ error: '新歌曲名称已存在' });
  db.prepare('UPDATE songs SET name = ? WHERE name = ?').run(newName, old_name);
  res.json({ message: '歌曲重命名成功', song: getSongByName(newName) });
});

app.post('/guitar-api/songs/reorder', (req, res) => {
  const { song_names } = req.body;
  if (!Array.isArray(song_names)) return res.status(400).json({ error: 'song_names 必须是数组' });
  const all = db.prepare('SELECT name FROM songs').all();
  const nameSet = new Set(all.map(r => r.name));
  for (const n of song_names) {
    if (!nameSet.has(n)) return res.status(400).json({ error: `歌曲 '${n}' 不存在` });
  }
  const update = db.prepare('UPDATE songs SET sort_order = ? WHERE name = ?');
  db.transaction((names) => { for (let i = 0; i < names.length; i++) update.run(i, names[i]); })(song_names);
  res.json({ message: '歌单排序更新成功' });
});

// ---- 图片下载 ----

async function downloadImage(url, index) {
  try {
    const resp = await axios.get(url, {
      timeout: 10000,
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': new URL(url).origin + '/',
      }
    });
    const ct = resp.headers['content-type'] || '';
    const ext = ct.includes('png') ? '.png' : ct.includes('gif') ? '.gif' : ct.includes('webp') ? '.webp' : '.jpg';
    let filename = `${crypto.randomUUID()}${ext}`;
    let filepath = path.join(IMAGE_DIR, filename);
    let counter = 1;
    while (fs.existsSync(filepath)) {
      filename = `${safe}_${index}_${counter}${ext}`;
      filepath = path.join(IMAGE_DIR, filename);
      counter++;
    }
    const writer = fs.createWriteStream(filepath);
    resp.data.pipe(writer);
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
    return `/guitar-images/${filename}`;
  } catch (e) {
    console.error(`下载失败 ${url}:`, e.message);
    return null;
  }
}

async function searchBingResults(query, maxResults = 3) {
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
  const links = [];
  $('#b_results .b_algo h2 a').each((_, el) => {
    const href = $(el).attr('href');
    if (href) links.push(href);
  });
  return links.slice(0, maxResults);
}

async function parseImagesFromUrl(url) {
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
  const urls = new Set();

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

app.post('/guitar-api/tabs/:title', async (req, res) => {
  const { title } = req.params;
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: '缺少 url 参数' });
  let row = db.prepare('SELECT * FROM songs WHERE name = ?').get(title);
  if (!row) {
    const nextOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS v FROM songs').get().v;
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
    res.status(500).json({ error: `解析失败: ${e.message}` });
  }
});

app.post('/guitar-api/tabs/:name/auto-fetch', async (req, res) => {
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
    const attemptLogs = [];

    for (let i = 0; i < resultUrls.length; i++) {
      if (Date.now() - startTime > TOTAL_TIMEOUT) {
        attemptLogs.push({ url: resultUrls[i], error: '总超时 30 秒，跳过' });
        break;
      }

      if (i > 0) await new Promise(r => setTimeout(r, 1000));

      console.log(`[auto-fetch] 正在尝试 (${i + 1}/${resultUrls.length}): ${resultUrls[i]}`);

      try {
        const result = await Promise.race([
          parseImagesFromUrl(resultUrls[i]),
          new Promise((_, reject) => setTimeout(() => reject(new Error('超时(5s)')), ATTEMPT_TIMEOUT))
        ]);

        if (result && result.type === 'image' && result.data && result.data.length > 0) {
          console.log(`[auto-fetch] ✓ 成功: ${resultUrls[i]} (${result.data.length} 张图片)`);
          return res.json({ source_url: resultUrls[i], candidate_images: result.data });
        }
        const msg = '未提取到图片';
        console.log(`[auto-fetch] ✗ ${resultUrls[i]} — ${msg}`);
        attemptLogs.push({ url: resultUrls[i], error: msg });
      } catch (e) {
        const msg = e.message;
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
    res.status(500).json({ error: `自动获取失败: ${e.message}` });
  }
});

function deleteOldImages(oldUrls) {
  for (const url of oldUrls) {
    if (url.startsWith('/guitar-images/')) {
      const filename = path.basename(url);
      const filepath = path.join(IMAGE_DIR, filename);
      fs.unlink(filepath, (err) => {
        if (err && err.code !== 'ENOENT') console.error('删除旧图片失败:', filepath, err.message);
      });
    }
  }
}

app.post('/guitar-api/tabs/:name/save', async (req, res) => {
  const { name } = req.params;
  const { images, mode } = req.body;
  if (!Array.isArray(images)) return res.status(400).json({ error: 'images 必须是数组' });
  const row = db.prepare('SELECT * FROM songs WHERE name = ?').get(name);
  if (!row) return res.status(404).json({ error: '歌曲未找到' });

  if (mode === 'reorder') {
    db.prepare('UPDATE songs SET img_url = ? WHERE name = ?').run(JSON.stringify(images), name);
    return res.json({ message: '顺序已更新' });
  }

  const oldUrls = JSON.parse(row.img_url);
  deleteOldImages(oldUrls);

  const localUrls = [];
  for (let i = 0; i < images.length; i++) {
    const local = await downloadImage(images[i], i + 1);
    if (local) localUrls.push(local);
  }

  const hadImages = oldUrls.length > 0;
  const createdAt = (!hadImages && localUrls.length > 0) ? new Date().toISOString() : row.created_at;
  db.prepare('UPDATE songs SET img_url = ?, created_at = ? WHERE name = ?').run(JSON.stringify(localUrls), createdAt, name);
  res.json({ message: '保存成功', count: localUrls.length });
});

app.put('/guitar-api/tabs/:name/images', (req, res) => {
  const { name } = req.params;
  const { images } = req.body;
  if (!Array.isArray(images)) return res.status(400).json({ error: 'images 必须是数组' });
  const row = db.prepare('SELECT name FROM songs WHERE name = ?').get(name);
  if (!row) return res.status(404).json({ error: '歌曲未找到' });
  db.prepare('UPDATE songs SET img_url = ? WHERE name = ?').run(JSON.stringify(images), name);
  res.json({ message: '图片更新成功', count: images.length });
});

app.post('/guitar-api/tabs/:name/reparse', async (req, res) => {
  const { name } = req.params;
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL 不能为空' });
  let row = db.prepare('SELECT * FROM songs WHERE name = ?').get(name);
  if (!row) {
    const nextOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS v FROM songs').get().v;
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
    res.status(500).json({ error: `解析失败: ${e.message}` });
  }
});

app.post('/guitar-api/tabs/:name/upload', upload.array('images', 10), async (req, res) => {
  const { name } = req.params;
  if (!req.files || req.files.length === 0) return res.status(400).json({ error: '未上传文件' });
  const row = db.prepare('SELECT * FROM songs WHERE name = ?').get(name);
  if (!row) return res.status(404).json({ error: '歌曲未找到' });
  const paths = req.files.map(f => `/guitar-images/${f.filename}`);
  const existing = JSON.parse(row.img_url);
  db.prepare('UPDATE songs SET img_url = ? WHERE name = ?').run(JSON.stringify([...existing, ...paths]), name);
  res.json({ message: '上传成功', count: paths.length, images: paths });
});

// ---- AI 搜索 ----

app.post('/guitar-api/ai-search', async (req, res) => {
  const DEEPSEEK_KEY = process.env.DEEPSEEK_KEY;
  if (!DEEPSEEK_KEY) return res.status(500).json({ error: 'AI 搜索未配置（缺少 DEEPSEEK_KEY）' });

  const { searchTerm, songNames } = req.body;
  if (!searchTerm || !Array.isArray(songNames)) return res.status(400).json({ error: '参数错误' });

  try {
    const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
      model: 'deepseek-v4-flash',
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
    console.error('AI search error:', err.message);
    res.status(502).json({ error: 'AI 搜索失败' });
  }
});

// ---- 访问记录 ----

app.post('/guitar-api/visit', (req, res) => {
  const { uuid, userAgent } = req.body;
  if (!uuid) return res.status(400).json({ error: '缺少 uuid' });

  db.prepare('INSERT INTO visits (date, time, uuid, ip, user_agent) VALUES (?, ?, ?, ?, ?)').run(
    new Date().toISOString().slice(0, 10),
    new Date().toISOString(),
    uuid,
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
    userAgent || '',
  );

  res.json({ ok: true });
});

// ---- 静态文件 ----

const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res) => {
    if (!req.path.startsWith('/guitar-api/')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`吉他谱 API 服务运行在 http://0.0.0.0:${PORT}`);
});
