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
const IMAGE_DIR = path.join(__dirname, 'images');

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
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
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

// 从页面提取图片
async function parseImagesFromUrl(url) {
  const resp = await axios.get(url, {
    timeout: 20000,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36' }
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
  const song = { name, imgUrl: [] };
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
    target = { name: title, imgUrl: [] };
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

  // 删除旧的本地图片
  deleteOldImages(target.imgUrl);

  // 正常保存：下载图片到本地
  const localUrls = [];
  for (let i = 0; i < images.length; i++) {
    const local = await downloadImage(images[i], i + 1);
    if (local) localUrls.push(local);
  }
  target.imgUrl = localUrls;
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
    target = { name, imgUrl: [] };
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
