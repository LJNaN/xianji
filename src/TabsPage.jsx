import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button, Card, Input, Space, Alert, Spin, Typography,
  Checkbox, message, Modal, Switch, Slider
} from 'antd';
import {
  LoadingOutlined, LeftOutlined,
  SearchOutlined, SettingOutlined, UploadOutlined, HolderOutlined,
  HeartOutlined, HeartFilled
} from '@ant-design/icons';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import './App.css';

const { Title, Text } = Typography;

function proxyUrl(url) {
  if (!url || url.startsWith('/guitar-images/')) return url;
  return `/guitar-api/proxy-image?url=${encodeURIComponent(url)}`;
}

function TabsPage() {
  const { name } = useParams();
  const navigate = useNavigate();
  const [song, setSong] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [customUrl, setCustomUrl] = useState('');
  const [candidateImages, setCandidateImages] = useState([]);
  const [selectedImages, setSelectedImages] = useState([]);
  const [showSelector, setShowSelector] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(1.0);
  const transformRef = useRef(null);
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isSliderDragging, setIsSliderDragging] = useState(false);
  const [autoFetching, setAutoFetching] = useState(false);
  const [autoFetchError, setAutoFetchError] = useState(null);
  const [barVisible, setBarVisible] = useState(true);
  const [isFavorited, setIsFavorited] = useState(false);
  const [heartAnimating, setHeartAnimating] = useState(false);
  const hideTimerRef = useRef(null);

  function getColumnsByViewport(w, h) {
    const ratio = w / h;

    // 窄屏手机：永远 1 列
    if (w < 600) return 1;

    // 带鱼屏 / 超宽屏 (≥ 21:9)：充分利用宽度
    if (ratio >= 2.3) {
      if (w >= 2560) return 6;
      if (w >= 1920) return 5;
      if (w >= 1280) return 4;
      return 3;
    }

    // 标准屏 ~16:9 (1.5 ~ 2.0)
    if (ratio >= 1.5) {
      if (w >= 1440) return 3;
      if (w >= 768) return 2;
      return 1;
    }

    // 偏方屏如 iPad 4:3
    if (w >= 1024) return 2;
    return 1;
  }

  const [columns, setColumns] = useState(() => getColumnsByViewport(window.innerWidth, window.innerHeight));
  const [autoColumns, setAutoColumns] = useState(true);

  // 窗口 resize 防抖监听，自动计算列数
  useEffect(() => {
    if (!autoColumns) return;

    let timer;
    const handleResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        setColumns(getColumnsByViewport(window.innerWidth, window.innerHeight));
      }, 200);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, [autoColumns]);

  useEffect(() => {
    fetch('/guitar-api/songs')
      .then(res => res.json())
      .then(songs => {
        const found = songs.find(s => s.name === name);
        if (found) {
          setSong(found);
          setIsFavorited(found.favorite || false);
          setLoading(false);
          if (found.imgUrl && found.imgUrl.length > 0) {
            setSelectedImages(found.imgUrl);
          }
        } else {
          setError('歌曲未找到');
          setLoading(false);
        }
      })
      .catch(err => {
        setError('加载失败');
        setLoading(false);
      });
  }, [name]);


  const handleFetchFromUrl = async () => {
    if (!customUrl.trim()) {
      message.warning('请输入有效的URL');
      return;
    }

    setFetching(true);
    try {
      const res = await fetch(`/guitar-api/tabs/${encodeURIComponent(name)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: customUrl })
      });
      const data = await res.json();
      if (res.ok) {
        setCandidateImages(data.candidate_images || []);
        setShowSelector(true);
        setSelectedImages([]);
        setFetching(false);
      } else {
        message.error(data.error || '从该页面提取图片失败');
        setFetching(false);
      }
    } catch (err) {
      message.error('请求失败');
      setFetching(false);
    }
  };

  const handleAutoFetch = async () => {
    setAutoFetching(true);
    setAutoFetchError(null);
    try {
      const res = await fetch(`/guitar-api/tabs/${encodeURIComponent(name)}/auto-fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (res.ok && data.candidate_images && data.candidate_images.length > 0) {
        setCandidateImages(data.candidate_images);
        setSelectedImages([]);
        setShowSelector(true);
      } else {
        setAutoFetchError(data.error || '未找到相关图片');
      }
    } catch (err) {
      setAutoFetchError('自动获取请求失败');
    } finally {
      setAutoFetching(false);
    }
  };

  const toggleImageSelection = (url) => {
    setSelectedImages(prev =>
      prev.includes(url)
        ? prev.filter(u => u !== url)
        : [...prev, url]
    );
  };

  const handleSaveSelected = async () => {
    if (selectedImages.length === 0) {
      message.warning('请至少选择一张图片');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/guitar-api/tabs/${encodeURIComponent(name)}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: selectedImages })
      });
      const data = await res.json();
      if (res.ok) {
        message.success('保存成功！');
        setSong(prev => ({ ...prev, imgUrl: selectedImages }));
        setShowSelector(false);
        setSaving(false);
      } else {
        setError(data.error || '保存失败');
        setSaving(false);
      }
    } catch (err) {
      setError('保存失败');
      setSaving(false);
    }
  };

  const handleBack = () => {
    navigate('/');
  };

  const handleToggleFavorite = async () => {
    const newFav = !isFavorited;
    setIsFavorited(newFav);
    if (newFav) {
      setHeartAnimating(true);
      setTimeout(() => setHeartAnimating(false), 800);
    }
    try {
      const res = await fetch(`/guitar-api/songs/${encodeURIComponent(name)}/favorite`, { method: 'PUT' });
      if (!res.ok) throw new Error('请求失败');
      const data = await res.json();
      setIsFavorited(data.favorite);
    } catch (err) {
      console.error('切换最爱失败:', err);
      setIsFavorited(isFavorited);
    }
  };

  const handleClearImages = async () => {
    Modal.confirm({
      title: '确认清空',
      content: '确定要清空所有吉他谱图片吗？',
      okText: '清空',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await fetch(`/guitar-api/tabs/${encodeURIComponent(name)}/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ images: [] })
          });
          if (res.ok) {
            setSelectedImages([]);
            message.success('已清空');
          } else {
            message.error('清空失败');
          }
        } catch {
          message.error('清空失败');
        }
      }
    });
  };

  const handleReorderSave = async (newOrder) => {
    setSelectedImages(newOrder);
    try {
      const res = await fetch(`/guitar-api/tabs/${encodeURIComponent(name)}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: newOrder, mode: 'reorder' })
      });
      if (res.ok) message.success('顺序已更新');
    } catch {
      message.error('顺序更新失败');
    }
  };

  const handleUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const formData = new FormData();
    for (const f of files) formData.append('images', f);
    try {
      const res = await fetch(`/guitar-api/tabs/${encodeURIComponent(name)}/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        setSelectedImages(prev => [...prev, ...data.images]);
        message.success(`上传成功 ${data.count} 张`);
      } else {
        message.error(data.error || '上传失败');
      }
    } catch {
      message.error('上传失败');
    }
    e.target.value = '';
  };

  // 自动滚动：通过 transformRef 控制位置
  useEffect(() => {
    if (!isAutoScrolling || scrollSpeed <= 0) {
      if (scrollRef.current) {
        cancelAnimationFrame(scrollRef.current);
        scrollRef.current = null;
      }
      return;
    }

    const speedPxPerSec = scrollSpeed * 8;
    let lastTime = performance.now();
    let remainder = 0;

    const animate = (now) => {
      const dt = Math.min(now - lastTime, 100);
      lastTime = now;

      const scrolled = speedPxPerSec * (dt / 1000);
      remainder += scrolled;
      let scrollDelta = Math.floor(remainder);
      remainder -= scrollDelta;

      if (scrollDelta <= 0) {
        scrollRef.current = requestAnimationFrame(animate);
        return;
      }

      const ctx = transformRef.current;
      if (!ctx) {
        scrollRef.current = null;
        return;
      }

      const { scale, positionX, positionY } = ctx.state;
      const newY = positionY - scrollDelta / scale;

      ctx.setTransform(positionX, newY, scale, 0);

      // 位置未变化说明已到达边界，停止滚动
      if (ctx.state.positionY === positionY) {
        setIsAutoScrolling(false);
        scrollRef.current = null;
        return;
      }

      scrollRef.current = requestAnimationFrame(animate);
    };

    scrollRef.current = requestAnimationFrame(animate);

    return () => {
      if (scrollRef.current) {
        cancelAnimationFrame(scrollRef.current);
        scrollRef.current = null;
      }
    };
  }, [isAutoScrolling, scrollSpeed]);



  // 浮动栏自动隐藏：仅看图时有效，2秒无操作隐藏
  useEffect(() => {
    if (selectedImages.length === 0 || showSelector) return;

    const showBar = () => {
      setBarVisible(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => setBarVisible(false), 2000);
    };

    showBar();

    // 在 document 层监听，避免被 react-zoom-pan-pinch 等组件拦截
    document.addEventListener('mousemove', showBar);
    document.addEventListener('touchstart', showBar, { passive: true });
    document.addEventListener('touchmove', showBar, { passive: true });

    return () => {
      document.removeEventListener('mousemove', showBar);
      document.removeEventListener('touchstart', showBar);
      document.removeEventListener('touchmove', showBar);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [selectedImages.length, showSelector]);

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
        <Button onClick={handleBack} icon={<LeftOutlined />} style={{ marginTop: '16px' }}>
          返回歌单
        </Button>
      </div>
    );
  }

  return (
    <div className="app-container detail-container">
      <Card className="detail-card">
        {/* 顶部栏 - 始终显示 */}
        {!loading && !error && (
          <div className={`floating-bar${!barVisible ? ' floating-bar-hidden' : ''}`}>
            <div className="floating-left">
              <Button onClick={handleBack} icon={<LeftOutlined />} size="small" shape="circle" />
              <span className="floating-title">{name}</span>
            </div>

            {selectedImages.length > 0 && !showSelector && (
              <div className="floating-center">
                <Switch
                  size="small"
                  checked={isAutoScrolling}
                  onChange={(checked) => setIsAutoScrolling(checked)}
                />
                <span className="floating-label">自动滚动</span>
                <div className="floating-slider-row">
                  <Slider
                    min={0}
                    max={10}
                    step={0.1}
                    value={scrollSpeed}
                    onChange={(value) => setScrollSpeed(value)}
                    className="floating-slider"
                    tooltip={{ open: false }}
                    onFocus={() => setIsSliderDragging(true)}
                    onBlur={() => setIsSliderDragging(false)}
                  />
                  <span className="floating-speed">{scrollSpeed.toFixed(1)}x</span>
                </div>
              </div>
            )}

            <div className="floating-right">
              <div className={`heart-btn-wrapper ${heartAnimating ? 'heart-pop' : ''}`}>
                <Button
                  type="text"
                  icon={isFavorited ? <HeartFilled style={{ color: '#e8453c' }} /> : <HeartOutlined />}
                  onClick={handleToggleFavorite}
                  className="floating-settings-btn"
                />
              </div>
              {selectedImages.length > 0 && !showSelector && (
                <Button
                  type="text"
                  icon={<SettingOutlined />}
                  onClick={() => setSettingsOpen(true)}
                  className="floating-settings-btn"
                />
              )}
            </div>
          </div>
        )}

        {/* 图片查看器 */}
        {selectedImages.length > 0 && !showSelector && (
          <div className="detail-body">
            <TransformWrapper
              ref={transformRef}
              minScale={0.3}
              maxScale={3}
              wheel={{ disabled: false, step: 0.001 }}
              pinch={{ disabled: false }}
              panning={{ disabled: false, velocityDisabled: true }}
              doubleClick={{ mode: "reset" }}
              limitToBounds={true}
            >
              <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }}>
                <div className="tabs-grid">
                  {selectedImages.map((url, i) => (
                    <img
                      key={i}
                      src={proxyUrl(url)}
                      alt={`谱 ${i + 1}`}
                      className="detail-image"
                      style={{ width: `calc((100% - ${(columns - 1) * 8}px) / ${columns})`, flex: `0 0 calc((100% - ${(columns - 1) * 8}px) / ${columns})` }}
                    />
                  ))}
                </div>
              </TransformComponent>
            </TransformWrapper>
          </div>
        )}

        {selectedImages.length === 0 && !showSelector && (
          <div className="detail-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {autoFetching ? (
              <div style={{ textAlign: 'center' }}>
                <Spin indicator={<LoadingOutlined style={{ fontSize: 28 }} spin />} />
                <p style={{ marginTop: 16, color: '#666', fontSize: 15 }}>正在自动搜索 &ldquo;{name}吉他谱&rdquo;...</p>
              </div>
            ) : (
              <div style={{ textAlign: 'center', width: '100%', maxWidth: 500, padding: '0 20px', boxSizing: 'border-box' }}>
                <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>🎸</div>
                <Text type="secondary" style={{ fontSize: 15, display: 'block', marginBottom: 16 }}>
                  暂无吉他谱，试试以下方式添加
                </Text>
                {autoFetchError && (
                  <Alert
                    message="自动获取失败"
                    description={autoFetchError}
                    type="warning"
                    showIcon
                    style={{ marginBottom: 16, textAlign: 'left' }}
                  />
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <Button type="primary" onClick={handleAutoFetch} icon={<SearchOutlined />} size="large" block>
                    {autoFetchError ? '重试自动获取' : '自动获取'}
                  </Button>
                  <Button
                    target="_blank"
                    href={`https://cn.bing.com/search?q=${encodeURIComponent(name)}吉他谱`}
                    icon={<SearchOutlined />}
                    block
                  >
                    去 Bing 搜索
                  </Button>
                  <Button icon={<UploadOutlined />} onClick={() => fileInputRef.current?.click()} block>
                    本地上传
                  </Button>
                  <Input.Search
                    placeholder="或输入吉他谱页面URL"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    loading={fetching}
                    enterButton="提取"
                    onSearch={handleFetchFromUrl}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {showSelector && (
          <div className="detail-body" style={{ padding: '0 20px 20px' }}>
            <Title level={4} style={{ margin: '10px 0' }}>请选择有效的吉他谱图片</Title>
            <Space wrap size={[8, 16]} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' }}>
              {candidateImages.map((url, i) => (
                <div
                  key={i}
                  style={{
                    position: 'relative',
                    boxSizing: 'border-box',
                    border: selectedImages.includes(url) ? '2px solid #52c41a' : '2px solid #d9d9d9',
                    borderRadius: '4px',
                    padding: '4px'
                  }}
                >
                  <img
                    src={proxyUrl(url)}
                    alt={`候选 ${i + 1}`}
                    width={200}
                    height={250}
                    style={{ objectFit: 'contain', cursor: 'pointer', display: 'block' }}
                    onClick={() => toggleImageSelection(url)}
                  />
                  <Checkbox
                    checked={selectedImages.includes(url)}
                    onChange={() => toggleImageSelection(url)}
                    style={{ position: 'absolute', top: 8, right: 8 }}
                  />
                </div>
              ))}
            </Space>

            <div style={{ marginTop: '16px', paddingBottom: '16px', textAlign: 'center' }}>
              <Space>
                <Button
                  type="primary"
                  onClick={handleSaveSelected}
                  loading={saving}
                  disabled={selectedImages.length === 0}
                >
                  保存选中的 {selectedImages.length} 张图片
                </Button>
                <Button onClick={() => setShowSelector(false)}>
                  取消
                </Button>
              </Space>
            </div>
          </div>
        )}
      </Card>

      {/* 设置弹窗 */}
      <Modal
        title="图片管理"
        open={settingsOpen}
        onCancel={() => setSettingsOpen(false)}
        footer={null}
        width={520}
      >
        {/* 图片排序 */}
        {selectedImages.length > 1 && (
          <div style={{ marginBottom: 24 }}>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>调整顺序（拖拽）</Text>
            <SettingsImageList
              images={selectedImages}
              onReorder={handleReorderSave}
            />
          </div>
        )}

        {/* 重新解析 */}
        <div style={{ marginBottom: 24 }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>解析其他URL</Text>
          <div style={{ display: 'flex', gap: 8 }}>
            <Input
              placeholder="输入吉他谱页面URL"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              style={{ flex: 1 }}
            />
            <Button
              type="primary"
              onClick={handleFetchFromUrl}
              loading={fetching}
              disabled={!customUrl.trim()}
            >
              解析
            </Button>
          </div>
        </div>

        {/* 多列显示 */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text strong>同时展示列数</Text>
            <Space size={4}>
              <Text style={{ fontSize: 12, color: '#999' }}>{autoColumns ? '自动' : '手动'}</Text>
              <Switch
                size="small"
                checked={autoColumns}
                onChange={(checked) => {
                  setAutoColumns(checked);
                  if (checked) setColumns(getColumnsByViewport(window.innerWidth, window.innerHeight));
                }}
              />
            </Space>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Slider
              min={1}
              max={6}
              value={columns}
              onChange={(value) => {
                setColumns(value);
                setAutoColumns(false);
              }}
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: 14, color: '#666', minWidth: 36, flexShrink: 0 }}>{columns}列</span>
          </div>
        </div>

        {/* 操作按钮 */}
        <Space>
          {selectedImages.length > 0 && (
            <Button danger onClick={handleClearImages}>
              清空所有图片
            </Button>
          )}
          <Button icon={<UploadOutlined />} onClick={() => fileInputRef.current?.click()}>
            上传图片
          </Button>
        </Space>
      </Modal>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={handleUpload}
      />
    </div>
  );
}

// 排序列表中的可拖拽图片项
function SortableImageItem({ url, index }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: url,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 8px',
    marginBottom: 4,
    background: '#fff',
    border: '1px solid #f0f0f0',
    borderRadius: 6,
    cursor: 'grab',
    touchAction: 'none',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <img src={proxyUrl(url)} alt="" style={{ width: 40, height: 50, objectFit: 'contain', flexShrink: 0 }} />
      <Text ellipsis style={{ flex: 1, fontSize: 13 }}>图片 {index + 1}</Text>
      <HolderOutlined style={{ color: '#999' }} />
    </div>
  );
}

// 设置弹窗中的排序列表
function SettingsImageList({ images, onReorder }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIndex = images.findIndex((url) => url === active.id);
      const newIndex = images.findIndex((url) => url === over.id);
      onReorder(arrayMove(images, oldIndex, newIndex));
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={images} strategy={verticalListSortingStrategy}>
        {images.map((url, i) => (
          <SortableImageItem key={url} url={url} index={i} />
        ))}
      </SortableContext>
    </DndContext>
  );
}

export default TabsPage;