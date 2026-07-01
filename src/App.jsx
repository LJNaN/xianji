import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Spin, Alert, Typography, Input, Modal, message, ConfigProvider, Select } from 'antd';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { LoadingOutlined, EditOutlined, SaveOutlined, SearchOutlined, PlusOutlined } from '@ant-design/icons';
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
  const [isEditing, setIsEditing] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newSongName, setNewSongName] = useState('');
  const [activeId, setActiveId] = useState(null);
  const [sortMode, setSortMode] = useState(() => localStorage.getItem('sortMode') || 'latest');
  const [hasFetched, setHasFetched] = useState(false);

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
    } else if (sortMode !== 'custom') {
      result.sort((a, b) => sortByDate(a, b, false));
    }
    // 'custom' 模式保持数组原序（即拖拽排序后的顺序）

    setFilteredSongs(result);
    setLoading(false);
  }, [searchTerm, songs, sortMode, hasFetched]);

  // 记住用户选择的排序模式
  useEffect(() => {
    localStorage.setItem('sortMode', sortMode);
  }, [sortMode]);

  // dnd-kit 传感器配置（移动端优化）
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
        delay: 100,
        tolerance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 拖拽开始
  const handleDragStart = useCallback((event) => {
    setActiveId(event.active.id);
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
  }, []);

  // 拖拽结束
  const handleDragEnd = useCallback((event) => {
    setActiveId(null);
    document.body.style.userSelect = '';
    document.body.style.webkitUserSelect = '';
    const { active, over } = event;

    if (active.id !== over?.id) {
      setFilteredSongs((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }, []);

  // 删除歌曲
  const handleDelete = async (name) => {
    Modal.confirm({
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
    if (!newSongName.trim()) {
      message.warning('请输入歌曲名称');
      return;
    }

    try {
      const response = await fetch('/guitar-api/songs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSongName.trim() })
      });

      if (!response.ok) throw new Error('新增失败');

      // 更新本地状态
      const newSong = {
        id: `song-${Date.now()}`,
        name: newSongName.trim(),
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

  // 保存排序到后端
  const saveOrder = useCallback(async () => {
    try {
      const response = await fetch('/guitar-api/songs/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          song_names: filteredSongs.map(s => s.name)
        })
      });

      if (!response.ok) throw new Error('保存失败');

      // 同步主列表顺序
      setSongs([...filteredSongs]);
      setIsEditing(false);
      message.success('排序已保存');
    } catch (err) {
      console.error('保存排序失败:', err);
      message.error('保存失败，请重试');
    }
  }, [filteredSongs]);

  const handleSongClick = (name) => {
    if (!isEditing) {
      const song = songs.find(s => s.name === name);
      navigate(`/detail/${encodeURIComponent(name)}`, { state: { song } });
    }
  };

  const activeItem = filteredSongs.find((item) => item.id === activeId);

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
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#389e0d',
        },
      }}
    >
      <div className="app-container">
        <Card
          style={{ flex: 1 }}
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width="28" height="28" viewBox="0 0 100 100" style={{ flexShrink: 0 }}>
                <defs>
                  <linearGradient id="iconGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#52c41a"/>
                    <stop offset="100%" stop-color="#389e0d"/>
                  </linearGradient>
                </defs>
                <path d="M50 12C24 12 20 30 20 44C20 62 28 80 50 88C72 80 80 62 80 44C80 30 76 12 50 12Z" fill="url(#iconGrad)"/>
                <line x1="30" y1="30" x2="30" y2="74" stroke="#fff" stroke-width="2.8" stroke-linecap="round" opacity="0.9"/>
                <line x1="37" y1="26" x2="37" y2="78" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity="0.85"/>
                <line x1="44" y1="24" x2="44" y2="80" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity="0.8"/>
                <line x1="56" y1="24" x2="56" y2="80" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity="0.8"/>
                <line x1="63" y1="26" x2="63" y2="78" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity="0.85"/>
                <line x1="70" y1="30" x2="70" y2="74" stroke="#fff" stroke-width="2.8" stroke-linecap="round" opacity="0.9"/>
              </svg>
              <Title level={2} style={{ margin: 0 }}>弦集</Title>
              <span style={{ color: '#666', alignSelf: 'flex-end', paddingBottom: 2 }}>共 {filteredSongs.length} 首歌曲</span>
            </div>
          }
        >
          <>
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
                icon={isEditing ? <SaveOutlined /> : <EditOutlined />}
                onClick={() => isEditing ? saveOrder() : (setSortMode('custom'), setIsEditing(true))}
              >
                {isEditing ? "完成" : "编辑"}
              </Button>
              <Select
                value={sortMode}
                onChange={(value) => setSortMode(value)}
                className="control-sort"
                disabled={isEditing}
                options={[
                  { value: 'custom', label: '自定义排序' },
                  { value: 'latest', label: '最新添加' },
                  { value: 'oldest', label: '最早添加' },
                  { value: 'nameAsc', label: '字数从少到多' },
                  { value: 'nameDesc', label: '字数从多到少' },
                  { value: 'parsed', label: '已解析谱子' },
                  { value: 'unparsed', label: '未解析谱子' },
                ]}
              />
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={filteredSongs.map(s => s.id)} strategy={rectSortingStrategy}>
                <div className="song-grid">
                  {filteredSongs.length === 0 ? (
                    <div className="empty-state">
                      <div style={{ fontSize: 48, marginBottom: 12 }}>🎸</div>
                      <p style={{ color: '#999', fontSize: 16 }}>
                        {searchTerm ? '没有找到匹配的歌曲' : sortMode === 'parsed' ? '还没有已解析的谱子' : sortMode === 'unparsed' ? '所有歌曲都有谱子了' : '还没有添加任何歌曲'}
                      </p>
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => {
                          setSortMode('latest');
                          setSearchTerm('');
                        }}
                        style={{ marginTop: 16 }}
                      >
                        查看全部
                      </Button>
                    </div>
                  ) : (
                    filteredSongs.map((song) => (
                      <SongItem
                        key={song.id}
                        song={song}
                        isEditing={isEditing}
                        onSongClick={handleSongClick}
                        onDelete={handleDelete}
                        isDragging={activeId === song.id}
                      />
                    ))
                  )}
                </div>
              </SortableContext>

              {/* 拖拽浮层 - 提升移动端体验 */}
              <DragOverlay>
                {activeItem ? (
                  <div className="drag-overlay">
                    <Button
                      size="large"
                      style={{
                        width: '100%',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {activeItem.name}
                    </Button>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </>
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
      </div>
    </ConfigProvider>
  );
}

export default App;
