require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 5000;
const DATA_FILE = path.join(__dirname, 'song_list.json');
const VISITS_FILE = path.join(__dirname, 'visits.json');
const IMAGE_DIR = path.join(__dirname, 'images');

// 确保数据文件存在（若 Docker 挂载为目录则自动修复）
for (const f of [DATA_FILE, VISITS_FILE]) {
  if (fs.existsSync(f)) {
    const stat = fs.statSync(f);
    if (stat.isDirectory()) {
      fs.rmdirSync(f);
      fs.writeFileSync(f, '[]', 'utf-8');
      console.log(`[startup] ${f} 是目录，已重建为文件`);
    }
  } else {
    fs.writeFileSync(f, '[]', 'utf-8');
  }
}

app.use(cors());
app.use(express.json());
app.use('/guitar-images', express.static(IMAGE_DIR));

// 图片代理，解决 CDN 防盗链
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

function loadSongs() {
  if (fs.existsSync(DATA_FILE)) {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')).map(s => ({ favorite: false, ...s }));
  }
  return [];
}

function saveSongs(songs) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(songs, null, 2), 'utf-8');
}

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

// 从 Bing 搜索获取最多 maxResults 个结果 URL
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

// 从页面提取图片
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

// GET /guitar-api/songs
app.get('/guitar-api/songs', (req, res) => {
  res.json(loadSongs());
});

// POST /guitar-api/songs
app.post('/guitar-api/songs', (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: '歌曲名称不能为空' });
  const songs = loadSongs();
  if (songs.some(s => s.name === name)) return res.status(409).json({ error: '歌曲已存在' });
  const song = { name, imgUrl: [], favorite: false, createdAt: new Date().toISOString() };
  songs.push(song);
  saveSongs(songs);
  res.status(201).json({ message: '歌曲创建成功', song });
});

// DELETE /guitar-api/songs/:name
app.delete('/guitar-api/songs/:name', (req, res) => {
  const { name } = req.params;
  let songs = loadSongs();
  const before = songs.length;
  songs = songs.filter(s => s.name !== name);
  if (songs.length === before) return res.status(404).json({ error: '歌曲未找到' });
  saveSongs(songs);
  res.json({ message: '歌曲删除成功' });
});

// PUT /guitar-api/songs/:name/favorite — 切换最爱
app.put('/guitar-api/songs/:name/favorite', (req, res) => {
  const { name } = req.params;
  const songs = loadSongs();
  const target = songs.find(s => s.name === name);
  if (!target) return res.status(404).json({ error: '歌曲未找到' });
  target.favorite = !target.favorite;
  saveSongs(songs);
  res.json({ message: '更新成功', favorite: target.favorite });
});

// PUT /guitar-api/songs/:old_name
app.put('/guitar-api/songs/:old_name', (req, res) => {
  const { old_name } = req.params;
  const newName = (req.body.name || '').trim();
  if (!newName) return res.status(400).json({ error: '新歌曲名称不能为空' });
  const songs = loadSongs();
  const target = songs.find(s => s.name === old_name);
  if (!target) return res.status(404).json({ error: '原歌曲未找到' });
  if (songs.some(s => s.name === newName && s.name !== old_name)) return res.status(409).json({ error: '新歌曲名称已存在' });
  target.name = newName;
  saveSongs(songs);
  res.json({ message: '歌曲重命名成功', song: target });
});

// POST /guitar-api/songs/reorder
app.post('/guitar-api/songs/reorder', (req, res) => {
  const { song_names } = req.body;
  if (!Array.isArray(song_names)) return res.status(400).json({ error: 'song_names 必须是数组' });
  const songs = loadSongs();
  const map = {};
  songs.forEach(s => { map[s.name] = s; });
  for (const name of song_names) {
    if (!map[name]) return res.status(400).json({ error: `歌曲 '${name}' 不存在` });
  }
  const reordered = song_names.map(name => map[name]);
  saveSongs(reordered);
  res.json({ message: '歌单排序更新成功' });
});

// POST /guitar-api/tabs/:title — 解析吉他谱URL
app.post('/guitar-api/tabs/:title', async (req, res) => {
  const { title } = req.params;
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: '缺少 url 参数' });
  const songs = loadSongs();
  let target = songs.find(s => s.name === title);
  if (!target) {
    target = { name: title, favorite: false, imgUrl: [] };
    songs.push(target);
    saveSongs(songs);
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

// POST /guitar-api/tabs/:name/auto-fetch — 自动搜索并提取图片
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

      // 每个尝试间隔 1 秒，更真实
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

// POST /guitar-api/tabs/:name/save — 保存图片（支持 mode: 'reorder' 做纯排序）
app.post('/guitar-api/tabs/:name/save', async (req, res) => {
  const { name } = req.params;
  const { images, mode } = req.body;
  if (!Array.isArray(images)) return res.status(400).json({ error: 'images 必须是数组' });
  const songs = loadSongs();
  const target = songs.find(s => s.name === name);
  if (!target) return res.status(404).json({ error: '歌曲未找到' });

  if (mode === 'reorder') {
    // 纯排序：只更新顺序，不下载
    target.imgUrl = images;
    saveSongs(songs);
    return res.json({ message: '顺序已更新' });
  }

  // 首次添加谱子时记录时间
  const hadImages = target.imgUrl && target.imgUrl.length > 0;

  // 删除旧的本地图片
  deleteOldImages(target.imgUrl);

  // 正常保存：下载图片到本地
  const localUrls = [];
  for (let i = 0; i < images.length; i++) {
    const local = await downloadImage(images[i], i + 1);
    if (local) localUrls.push(local);
  }
  target.imgUrl = localUrls;
  if (!hadImages && localUrls.length > 0) {
    target.createdAt = new Date().toISOString();
  }
  saveSongs(songs);
  res.json({ message: '保存成功', count: localUrls.length });
});

// PUT /guitar-api/tabs/:name/images — 直接更新图片列表（排序/清空）
app.put('/guitar-api/tabs/:name/images', (req, res) => {
  const { name } = req.params;
  const { images } = req.body;
  if (!Array.isArray(images)) return res.status(400).json({ error: 'images 必须是数组' });
  const songs = loadSongs();
  const target = songs.find(s => s.name === name);
  if (!target) return res.status(404).json({ error: '歌曲未找到' });
  target.imgUrl = images;
  saveSongs(songs);
  res.json({ message: '图片更新成功', count: images.length });
});

// POST /guitar-api/tabs/:name/reparse
app.post('/guitar-api/tabs/:name/reparse', async (req, res) => {
  const { name } = req.params;
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL 不能为空' });
  const songs = loadSongs();
  let target = songs.find(s => s.name === name);
  if (!target) {
    target = { name, favorite: false, imgUrl: [] };
    songs.push(target);
    saveSongs(songs);
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

// POST /guitar-api/tabs/:name/upload — 本地上传图片
app.post('/guitar-api/tabs/:name/upload', upload.array('images', 10), async (req, res) => {
  const { name } = req.params;
  if (!req.files || req.files.length === 0) return res.status(400).json({ error: '未上传文件' });
  const songs = loadSongs();
  const target = songs.find(s => s.name === name);
  if (!target) return res.status(404).json({ error: '歌曲未找到' });
  const paths = req.files.map(f => `/guitar-images/${f.filename}`);
  target.imgUrl = [...target.imgUrl, ...paths];
  saveSongs(songs);
  res.json({ message: '上传成功', count: paths.length, images: paths });
});

// POST /guitar-api/ai-search — DeepSeek AI 搜索代理
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
        {
          role: 'system',
          content: `用户搜索了吉他谱关键词。可用的歌曲有：${songNames.join('、')}。从歌曲列表中找出最匹配的，按相关度排序，只返回 JSON 数组`,
        },
        { role: 'user', content: searchTerm },
      ],
      temperature: 0.1,
      max_tokens: 5000,
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_KEY}`,
      },
      timeout: 15000,
    });

    res.json(response.data);
  } catch (err) {
    console.error('AI search error:', err.message);
    res.status(502).json({ error: 'AI 搜索失败' });
  }
});

// POST /guitar-api/visit — 访问记录
app.post('/guitar-api/visit', (req, res) => {
  const { uuid, userAgent } = req.body;
  if (!uuid) return res.status(400).json({ error: '缺少 uuid' });

  if (fs.existsSync(VISITS_FILE)) {
    try { visits = JSON.parse(fs.readFileSync(VISITS_FILE, 'utf-8')); } catch {}
  }

  visits.push({
    date: new Date().toISOString().slice(0, 10),
    time: new Date().toISOString(),
    uuid,
    ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
    userAgent: userAgent || '',
  });

  fs.writeFileSync(VISITS_FILE, JSON.stringify(visits, null, 2), 'utf-8');
  res.json({ ok: true });
});

// 生产环境：打包后提供前端 SPA
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
