import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Spin, Alert, Typography, Input, Modal, message, Select, Switch, Radio } from 'antd';
import { LoadingOutlined, SearchOutlined, PlusOutlined, EditOutlined, CloseOutlined, SettingOutlined } from '@ant-design/icons';
import SongItem from './SongItem';
import './App.css';

const { Title } = Typography;
const { Search } = Input;

function App() {
  const navigate = useNavigate();
  const [songs, setSongs] = useState([]);
  const [filteredSongs, setFilteredSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newSongName, setNewSongName] = useState('');
  const [sortMode, setSortMode] = useState('latest');
  const [hasFetched, setHasFetched] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [favoriteSongs, setFavoriteSongs] = useState([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [inertiaEnabled, setInertiaEnabled] = useState(() => {
    const saved = localStorage.getItem('guitar-inertia');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [modalHolder, contextHolder] = Modal.useModal();

  const [themeMode, setThemeMode] = useState(() => {
    return localStorage.getItem('guitar-theme') || 'light';
  });

  // 持久化设置
  useEffect(() => {
    localStorage.setItem('guitar-inertia', JSON.stringify(inertiaEnabled));
  }, [inertiaEnabled]);
  useEffect(() => {
    localStorage.setItem('guitar-theme', themeMode);
    window.dispatchEvent(new Event('storage'));
  }, [themeMode]);

  // 加载歌单
  useEffect(() => {
    fetch('/guitar-api/songs')
      .then(response => {
        if (!response.ok) throw new Error('网络错误');
        return response.json();
      })
      .then(data => {
        const songData = Array.isArray(data)
          ? data.map((item, idx) => ({
            id: item.id || `song-${idx}`,
            name: item.name || item,
            imgUrl: Array.isArray(item.imgUrl) ? item.imgUrl : [],
            favorite: item.favorite || false,
            createdAt: item.createdAt || null,
          }))
          : [];
        setSongs(songData);
        setHasFetched(true);
      })
      .catch(err => {
        console.error('加载歌单失败:', err);
        setError('加载失败，请检查后端服务是否运行');
        setHasFetched(true);
        setLoading(false);
      });
  }, []);

  // 搜索 + 排序/筛选（首次等 fetch 完成再执行，避免 loading 提前结束）
  useEffect(() => {
    if (!hasFetched) return;

    let result = [...songs];

    // 搜索过滤
    if (searchTerm) {
      result = result.filter(song =>
        song.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // 筛选模式
    if (sortMode === 'parsed') {
      result = result.filter(song => song.imgUrl && song.imgUrl.length > 0);
    } else if (sortMode === 'unparsed') {
      result = result.filter(song => !song.imgUrl || song.imgUrl.length === 0);
    }

    // 排序（未解析的 createdAt 为 null，排到最后）
    const sortByDate = (a, b, asc) => {
      if (!a.createdAt && !b.createdAt) return 0;
      if (!a.createdAt) return 1;
      if (!b.createdAt) return -1;
      return asc
        ? new Date(a.createdAt) - new Date(b.createdAt)
        : new Date(b.createdAt) - new Date(a.createdAt);
    };

    // 排序
    if (sortMode === 'oldest') {
      result.sort((a, b) => sortByDate(a, b, true));
    } else if (sortMode === 'nameAsc') {
      result.sort((a, b) => a.name.length - b.name.length || a.name.localeCompare(b.name));
    } else if (sortMode === 'nameDesc') {
      result.sort((a, b) => b.name.length - a.name.length || a.name.localeCompare(b.name));
    } else {
      result.sort((a, b) => sortByDate(a, b, false));
    }

    setFilteredSongs(result);
    setLoading(false);
  }, [searchTerm, songs, sortMode, hasFetched]);

  // 提取最爱歌曲
  useEffect(() => {
    setFavoriteSongs(songs.filter(s => s.favorite));
  }, [songs]);

  // 切换最爱
  const handleToggleFavorite = async (name) => {
    try {
      const res = await fetch(`/guitar-api/songs/${encodeURIComponent(name)}/favorite`, {
        method: 'PUT',
      });
      if (!res.ok) throw new Error('请求失败');
      const data = await res.json();
      setSongs(prev => prev.map(s => s.name === name ? { ...s, favorite: data.favorite } : s));
      setFilteredSongs(prev => prev.map(s => s.name === name ? { ...s, favorite: data.favorite } : s));
    } catch (err) {
      console.error('切换最爱失败:', err);
    }
  };

  // 删除歌曲
  const handleDelete = async (name) => {
    modalHolder.confirm({
      title: '确认删除',
      content: `确定要删除歌曲 "${name}" 吗？`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const response = await fetch(`/guitar-api/songs/${encodeURIComponent(name)}`, {
            method: 'DELETE'
          });

          if (!response.ok) throw new Error('删除失败');

          // 更新本地状态
          const updatedSongs = songs.filter(song => song.name !== name);
          setSongs(updatedSongs);
          setFilteredSongs(updatedSongs.filter(song =>
            song.name.toLowerCase().includes(searchTerm.toLowerCase())
          ));
          message.success('删除成功');
        } catch (err) {
          console.error('删除失败:', err);
          message.error('删除失败，请重试');
        }
      }
    });
  };

  // 新增
  const handleAddSong = async () => {
    const name = newSongName.trim();
    if (!name) {
      message.warning('请输入歌曲名称');
      return;
    }

    // 检查是否已存在
    const existing = songs.find(s => s.name === name);
    if (existing) {
      modalHolder.confirm({
        title: '歌曲已存在',
        content: `「${name}」已存在，是否跳转？`,
        okText: '跳转',
        cancelText: '取消',
        onOk: () => {
          setIsAddModalOpen(false);
          setNewSongName('');
          navigate(`/detail/${encodeURIComponent(name)}`);
        },
      });
      return;
    }

    try {
      const response = await fetch('/guitar-api/songs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });

      if (!response.ok) throw new Error('新增失败');

      // 更新本地状态
      const newSong = {
        id: `song-${Date.now()}`,
        name,
        imgUrl: [],
        createdAt: new Date().toISOString(),
      };
      const updatedSongs = [...songs, newSong];
      setSongs(updatedSongs);
      setFilteredSongs([...filteredSongs, newSong]);
      setNewSongName('');
      setIsAddModalOpen(false);
      message.success('新增成功');
    } catch (err) {
      console.error('新增失败:', err);
      message.error('新增失败，请重试');
    }
  };

  const handleSongClick = (name) => {
    if (isEditing) return;
    const song = songs.find(s => s.name === name);
    navigate(`/detail/${encodeURIComponent(name)}`, { state: { song } });
  };

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
        <p style={{ marginTop: 12 }}>加载中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px' }}>
        <Alert message="错误" description={error} type="error" showIcon />
      </div>
    );
  }

  return (
      <div className="app-container">
        {contextHolder}
        <Card
          style={{ flex: 1 }}
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width="28" height="28" viewBox="0 0 100 100" style={{ flexShrink: 0 }}>
                <defs>
                  <linearGradient id="iconGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#52c41a"/>
                    <stop offset="100%" stopColor="#389e0d"/>
                  </linearGradient>
                </defs>
                <path d="M50 12C24 12 20 30 20 44C20 62 28 80 50 88C72 80 80 62 80 44C80 30 76 12 50 12Z" fill="url(#iconGrad)"/>
                <line x1="30" y1="30" x2="30" y2="74" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" opacity="0.9"/>
                <line x1="37" y1="26" x2="37" y2="78" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" opacity="0.85"/>
                <line x1="44" y1="24" x2="44" y2="80" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" opacity="0.8"/>
                <line x1="56" y1="24" x2="56" y2="80" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" opacity="0.8"/>
                <line x1="63" y1="26" x2="63" y2="78" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" opacity="0.85"/>
                <line x1="70" y1="30" x2="70" y2="74" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" opacity="0.9"/>
              </svg>
              <Title level={2} style={{ margin: 0 }}>弦集</Title>
              <span style={{ color: '#666', alignSelf: 'flex-end', paddingBottom: 2 }}>共 {filteredSongs.length} 首歌曲</span>
            </div>
          }
          extra={
            <Button
              type="text"
              icon={<SettingOutlined style={{ fontSize: 18 }} />}
              onClick={() => setSettingsOpen(true)}
            />
          }
        >
          <>
            {/* 最爱区域 */}
            {favoriteSongs.length > 0 && (
              <div className="favorites-section" style={{ marginBottom: 16, background: '#fff5f5', border: '1px solid #ffd7d5', borderRadius: 8, padding: '8px 8px 4px' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#e8453c', marginBottom: 8, paddingLeft: 4 }}>
                  ❤️ 最爱
                </div>
                <div className="song-grid" style={{ gap: 8 }}>
                  {favoriteSongs.map((song) => (
                    <SongItem
                      key={song.id}
                      song={song}
                      favorite={song.favorite}
                      onSongClick={handleSongClick}
                      onToggleFavorite={handleToggleFavorite}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 控制栏 */}
            <div className="control-bar">
              <Search
                placeholder="搜索歌曲..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="control-search"
                prefix={<SearchOutlined />}
              />

              <Button
                icon={<PlusOutlined />}
                onClick={() => setIsAddModalOpen(true)}
              >
                新增
              </Button>
              <Button
                type={isEditing ? "primary" : "default"}
                icon={isEditing ? <CloseOutlined /> : <EditOutlined />}
                onClick={() => setIsEditing(!isEditing)}
              >
                {isEditing ? "完成" : "编辑"}
              </Button>
              <Select
                value={sortMode}
                onChange={(value) => setSortMode(value)}
                className="control-sort"
                options={[
                  { value: 'latest', label: '最新添加' },
                  { value: 'oldest', label: '最早添加' },
                  { value: 'nameAsc', label: '字数从少到多' },
                  { value: 'nameDesc', label: '字数从多到少' },
                  { value: 'parsed', label: '已解析谱子' },
                  { value: 'unparsed', label: '未解析谱子' },
                ]}
              />
            </div>

            <div className="song-grid">
              {filteredSongs.length === 0 ? (
                <div className="empty-state">
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🎸</div>
                  <p style={{ color: '#999', fontSize: 16 }}>
                    {searchTerm ? '没有找到匹配的歌曲' : sortMode === 'parsed' ? '还没有已解析的谱子' : sortMode === 'unparsed' ? '所有歌曲都有谱子了' : '还没有添加任何歌曲'}
                  </p>
                  <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        setSortMode('latest');
                        setSearchTerm('');
                      }}
                    >
                      查看全部
                    </Button>
                    {searchTerm && (
                      <Button
                        icon={<PlusOutlined />}
                        onClick={() => {
                          setNewSongName(searchTerm);
                          setIsAddModalOpen(true);
                        }}
                      >
                        新增「{searchTerm}」
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                filteredSongs.map((song) => (
                  <SongItem
                    key={song.id}
                    song={song}
                    favorite={song.favorite}
                    isEditing={isEditing}
                    onSongClick={handleSongClick}
                    onDelete={handleDelete}
                    onToggleFavorite={handleToggleFavorite}
                  />
                ))
              )}
            </div>
          </>

          <div style={{ marginTop: '16px', padding: '16px 16px 0 16px', textAlign: 'center', fontSize: 12, color: '#999', borderTop: '1px solid #f0f0f0' }}>
            谱子都是网上扒的，没收费也没盈利。<br />
            歌版权归原作者，有啥问题别找我，找我也没用。
          </div>
        </Card>

        {/* 新增弹窗 */}
        <Modal
          title="新增"
          open={isAddModalOpen}
          onOk={handleAddSong}
          onCancel={() => setIsAddModalOpen(false)}
          okText="确定"
          cancelText="取消"
        >
          <Input
            placeholder="请输入歌曲名称"
            value={newSongName}
            onChange={(e) => setNewSongName(e.target.value)}
            onPressEnter={handleAddSong}
          />
        </Modal>

        {/* 全局设置弹窗 */}
        <Modal
          title="全局设置"
          open={settingsOpen}
          onCancel={() => setSettingsOpen(false)}
          footer={null}
          width={400}
          styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' } }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
            <div>
              <div style={{ fontWeight: 500 }}>拖拽惯性滑步</div>
              <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>单指拖动图片时松手后是否继续滑动</div>
            </div>
            <Switch
              checked={inertiaEnabled}
              onChange={(checked) => setInertiaEnabled(checked)}
            />
          </div>

          <div style={{ borderTop: '1px solid #f0f0f0', padding: '12px 0' }}>
            <div style={{ fontWeight: 500, marginBottom: 8 }}>主题模式</div>
            <Radio.Group
              value={themeMode}
              onChange={(e) => setThemeMode(e.target.value)}
              optionType="button"
              buttonStyle="solid"
            >
              <Radio.Button value="light">浅色</Radio.Button>
              <Radio.Button value="dark">深色</Radio.Button>
              <Radio.Button value="system">跟随系统</Radio.Button>
            </Radio.Group>
          </div>
        </Modal>
      </div>
  );
}

export default App;
