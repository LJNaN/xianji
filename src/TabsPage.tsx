import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button, Card, Input, Space, Alert, Spin, Typography,
  Checkbox, Select, Switch, Slider, Modal, App
} from 'antd';
import {
  LoadingOutlined, LeftOutlined,
  SearchOutlined, SettingOutlined, UploadOutlined, HolderOutlined,
  HeartOutlined, HeartFilled, ReloadOutlined
} from '@ant-design/icons';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TransformWrapper, TransformComponent, type ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import type { SongFromApi, AutoFetchResponse } from './types';
import { screenImages } from './imageStats';
import './App.css';

const { Title, Text } = Typography;

function proxyUrl(url: string): string {
  if (!url || url.startsWith('/guitar-images/')) return url;
  return `/guitar-api/proxy-image?url=${encodeURIComponent(url)}`;
}

// 一个来源整批都不像谱时最多连跳几个。跳太多会让加载转圈太久，
// 到顶就摊牌让人自己决定，反正「换一个来源」还能接着往后爬
const MAX_SOURCE_HOPS = 5;

function TabsPage() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const [song, setSong] = useState<SongFromApi | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customUrl, setCustomUrl] = useState('');
  const [candidateImages, setCandidateImages] = useState<string[]>([]);
  // 被筛掉的「明显不是谱」的图：不删数据、只是默认不显示，留个「显示全部」的退路
  const [hiddenImages, setHiddenImages] = useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = useState(false);
  // 这一轮已经跳过了几个「整批都是垃圾」的来源，用于加载提示
  const [skippedSources, setSkippedSources] = useState(0);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [showSelector, setShowSelector] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(1.0);
  const transformRef = useRef<ReactZoomPanPinchRef | null>(null);
  const scrollRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isSliderDragging, setIsSliderDragging] = useState(false);
  const [autoFetching, setAutoFetching] = useState(false);
  const [autoFetchError, setAutoFetchError] = useState<AutoFetchResponse | string | null>(null);
  // sourceIndex 是「当前这组候选图」的来源下标（只在成功时更新，用于显示）；
  // nextFrom 是「下一个该试的来源」下标，失败时也会往前推进。
  // 两者分开是因为换来源失败时显示的图还是旧的，下标不能跟着跳
  const [sourceIndex, setSourceIndex] = useState(0);
  const [sourceTotal, setSourceTotal] = useState(0);
  const [nextFrom, setNextFrom] = useState(0);
  const savedImagesRef = useRef<string[]>([]);
  const [barVisible, setBarVisible] = useState(true);
  const [isFavorited, setIsFavorited] = useState(false);
  const [heartAnimating, setHeartAnimating] = useState(false);
  const [editingName, setEditingName] = useState(name || '');
  const [renaming, setRenaming] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { message, modal } = App.useApp();

  function getColumnsByViewport(w: number, h: number): number {
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

    let timer: ReturnType<typeof setTimeout>;
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
      .then((songs: SongFromApi[]) => {
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
      .catch(() => {
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
      const res = await fetch(`/guitar-api/tabs/${encodeURIComponent(name || '')}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: customUrl })
      });
      const data: AutoFetchResponse = await res.json();
      if (res.ok) {
        setCandidateImages(data.candidate_images || []);
        // 指定 URL 提取的那条路不筛（用户是自己挑的页面），但要把上一批的筛选结果清掉，
        // 否则碰巧同名的 URL 会被莫名其妙藏起来
        setHiddenImages(new Set());
        setShowSelector(true);
        setSelectedImages([]);
      } else {
        message.error(data.error || '从该页面提取图片失败');
      }
    } catch {
      message.error('请求失败');
    } finally {
      setFetching(false);
    }
  };

  const handleAutoFetch = async (startFrom = 0) => {
    // 在结果页点「换一个来源」时失败，只是这一批不行，不该把页面切回空态
    const fromSelector = showSelector;
    // 只有第一次进来才记快照：换来源时「取消」应该退回到整个自动获取之前，
    // 而不是退回到上一批候选图（那批已经被替换掉了）
    if (!fromSelector) savedImagesRef.current = selectedImages;
    setAutoFetching(true);
    setAutoFetchError(null);
    setSkippedSources(0);
    try {
      let from = startFrom;
      let skipped = 0;
      // 一整批都是垃圾时留着，万一后面全是垃圾，至少还有东西给人看
      let lastJunkBatch: { images: string[]; hidden: string[]; index: number } | null = null;

      // 一个来源整批都是「不像谱」就直接跳过，接着爬下一个，
      // 别让一个全是 logo 和二维码的页面占着结果页
      for (let hop = 0; hop < MAX_SOURCE_HOPS; hop++) {
        const res = await fetch(`/guitar-api/tabs/${encodeURIComponent(name || '')}/auto-fetch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ startFrom: from })
        });
        const data: AutoFetchResponse & { error?: string } = await res.json();
        if (typeof data.total === 'number') setSourceTotal(data.total);
        // 失败时也用返回的 index 推进游标：那一批已经爬过了，下次不该重爬
        if (typeof data.index === 'number') setNextFrom(data.index + 1);

        const images = data.candidate_images;
        if (!res.ok || !images || images.length === 0) {
          // 后面的来源已经爬完了，把手里最后那批垃圾摊开，好过丢个错误页
          if (lastJunkBatch) break;
          if (fromSelector) message.warning(data.error || '没找到下一批图片');
          else setAutoFetchError(data);
          return;
        }

        setSourceIndex(data.index ?? from);
        // 先量完再决定显不显示，避免网格出来一堆垃圾再一张张消失
        const hidden = await screenImages(images, proxyUrl);
        if (hidden.length < images.length) {
          setCandidateImages(images);
          setHiddenImages(new Set(hidden));
          setShowHidden(false);
          setSelectedImages([]);
          setShowSelector(true);
          return;
        }

        lastJunkBatch = { images, hidden, index: data.index ?? from };
        from = (data.index ?? from) + 1;
        if (from >= (data.total ?? 0)) break;
        skipped++;
        setSkippedSources(skipped);
      }

      if (lastJunkBatch) {
        setSourceIndex(lastJunkBatch.index);
        setCandidateImages(lastJunkBatch.images);
        setHiddenImages(new Set(lastJunkBatch.hidden));
        // 爬到最后全是垃圾，那就全摊开让人自己挑，总比空网格强
        setShowHidden(true);
        setSelectedImages([]);
        setShowSelector(true);
      }
    } catch {
      if (fromSelector) message.warning('自动获取请求失败');
      else setAutoFetchError('自动获取请求失败');
    } finally {
      setAutoFetching(false);
    }
  };

  const hasNextSource = sourceTotal > 0 && nextFrom < sourceTotal;

  // 全被筛掉时不要摆一个空网格出来，直接把筛掉的也显示，并说明原因
  const allHidden = candidateImages.length > 0 && hiddenImages.size === candidateImages.length;
  const visibleCandidates = showHidden || allHidden
    ? candidateImages
    : candidateImages.filter(url => !hiddenImages.has(url));

  const toggleImageSelection = (url: string) => {
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
      const res = await fetch(`/guitar-api/tabs/${encodeURIComponent(name || '')}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: selectedImages })
      });
      const data = await res.json() as { error?: string };
      if (res.ok) {
        message.success('保存成功！');
        setSong(prev => prev ? { ...prev, imgUrl: selectedImages } : prev);
        setShowSelector(false);
      } else {
        setError(data.error || '保存失败');
      }
    } catch {
      setError('保存失败');
    } finally {
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
      const res = await fetch(`/guitar-api/songs/${encodeURIComponent(name || '')}/favorite`, { method: 'PUT' });
      if (!res.ok) throw new Error('请求失败');
      const data = await res.json() as { favorite: boolean };
      setIsFavorited(data.favorite);
    } catch (err) {
      console.error('切换最爱失败:', err);
      setIsFavorited(isFavorited);
    }
  };

  const handleClearImages = async () => {
    modal.confirm({
      title: '确认清空',
      content: '确定要清空所有吉他谱图片吗？',
      okText: '清空',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await fetch(`/guitar-api/tabs/${encodeURIComponent(name || '')}/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ images: [] })
          });
          if (res.ok) {
            setSelectedImages([]);
            setSettingsOpen(false);
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

  const handleRename = async () => {
    const newName = editingName.trim();
    if (!newName || newName === name) {
      setSettingsOpen(false);
      return;
    }
    setRenaming(true);
    try {
      const res = await fetch(`/guitar-api/songs/${encodeURIComponent(name || '')}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName })
      });
      if (res.ok) {
        message.success('歌名已更新');
        setSettingsOpen(false);
        navigate(`/detail/${encodeURIComponent(newName)}`, { replace: true });
      } else if (res.status === 409) {
        message.error('该歌名已存在');
      } else {
        message.error('重命名失败');
      }
    } catch {
      message.error('重命名失败');
    } finally {
      setRenaming(false);
    }
  };

  const handleReorderSave = async (newOrder: string[]) => {
    setSelectedImages(newOrder);
    try {
      const res = await fetch(`/guitar-api/tabs/${encodeURIComponent(name || '')}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: newOrder, mode: 'reorder' })
      });
      if (res.ok) message.success('顺序已更新');
    } catch {
      message.error('顺序更新失败');
    }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const formData = new FormData();
    for (const f of files) formData.append('images', f);
    (async () => {
      try {
        const res = await fetch(`/guitar-api/tabs/${encodeURIComponent(name || '')}/upload`, {
          method: 'POST',
          body: formData
        });
        const data = await res.json() as { count: number; images: string[]; error?: string };
        if (res.ok) {
          setSelectedImages(prev => [...prev, ...data.images]);
          message.success(`上传成功 ${data.count} 张`);
        } else {
          message.error(data.error || '上传失败');
        }
      } catch {
        message.error('上传失败');
      }
    })();
    e.target.value = '';
  };

  // 自动滚动：通过 transformRef 控制位置
  useEffect(() => {
    if (!isAutoScrolling || scrollSpeed <= 0) {
      if (scrollRef.current !== null) {
        cancelAnimationFrame(scrollRef.current);
        scrollRef.current = null;
      }
      return;
    }

    const speedPxPerSec = scrollSpeed * 8;
    let lastTime = performance.now();
    let remainder = 0;

    const animate = (now: number) => {
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
      if (scrollRef.current !== null) {
        cancelAnimationFrame(scrollRef.current);
        scrollRef.current = null;
      }
    };
  }, [isAutoScrolling, scrollSpeed]);



  // 打开设置弹窗时同步编辑的歌名
  useEffect(() => {
    if (settingsOpen) setEditingName(song?.name || name || '');
  }, [settingsOpen, song?.name, name]);

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
              {!showSelector && (
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
              panning={{ disabled: false, velocityDisabled: !(JSON.parse(localStorage.getItem('guitar-inertia') ?? 'true') as boolean) }}
              doubleClick={{ mode: "reset" }}
              limitToBounds={true}
            >
              <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ paddingTop: 48 }}>
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
                <p style={{ marginTop: 16, color: '#666', fontSize: 15 }}>
                  正在自动搜索 &ldquo;{name}吉他谱&rdquo;...
                  {skippedSources > 0 && (
                    <span style={{ display: 'block', fontSize: 13, color: '#999', marginTop: 4 }}>
                      已跳过 {skippedSources} 个没有谱的来源，继续往后找
                    </span>
                  )}
                </p>
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
                    description={
                      <div style={{ fontSize: 13 }}>
                        <div>{(autoFetchError as AutoFetchResponse).error || String(autoFetchError)}</div>
                        {(autoFetchError as AutoFetchResponse).details && (
                          <ul style={{ margin: '6px 0 0', paddingLeft: 18, color: '#888' }}>
                            {(autoFetchError as AutoFetchResponse).details!.map((d, i) => (
                              <li key={i} style={{ marginBottom: 2, wordBreak: 'break-all' }}>
                                <span style={{ color: d.error === '未提取到图片' ? '#666' : '#999' }}>{d.url}</span>
                                <span style={{ color: '#999' }}> — {d.error}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    }
                    type="warning"
                    showIcon
                    style={{ marginBottom: 16, textAlign: 'left' }}
                  />
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <Button
                    type="primary"
                    onClick={() => handleAutoFetch(autoFetchError ? nextFrom : 0)}
                    icon={<SearchOutlined />}
                    size="large"
                    block
                  >
                    {autoFetchError ? '重试自动获取' : '自动获取'}
                  </Button>
                  <Button
                    target="_blank"
                    href={`https://cn.bing.com/search?q=${encodeURIComponent(name || '')}吉他谱`}
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
              {visibleCandidates.map((url, i) => (
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
                    className="candidate-image"
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
              <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
                {sourceTotal > 1
                  ? `来源 ${sourceIndex + 1}/${sourceTotal}${hasNextSource ? '，这批不合适就换下一个来源' : '，已经是最后一个来源了'}`
                  : '这批不合适可以重试或换一个来源'}
              </div>
              <Space>
                <Button
                  type="primary"
                  onClick={handleSaveSelected}
                  loading={saving}
                  disabled={selectedImages.length === 0}
                >
                  保存选中的 {selectedImages.length} 张图片
                </Button>
                <Button
                  icon={<ReloadOutlined />}
                  loading={autoFetching}
                  disabled={!hasNextSource}
                  onClick={() => handleAutoFetch(nextFrom)}
                >
                  {autoFetching ? '获取中' : '换一个来源'}
                </Button>
                <Button onClick={() => { setShowSelector(false); setSelectedImages(savedImagesRef.current); }}>
                  取消
                </Button>
              </Space>
              {hiddenImages.size > 0 && !allHidden && (
                <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
                  已隐藏 {hiddenImages.size} 张明显不是谱的图
                  <Button type="link" size="small" onClick={() => setShowHidden(v => !v)}>
                    {showHidden ? '收起' : '显示全部'}
                  </Button>
                </div>
              )}
              {allHidden && (
                <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
                  往后找的来源里也全是这类图，已全部显示。
                  {hasNextSource && '可以点「换一个来源」继续往后找。'}
                </div>
              )}
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
        styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' } }}
      >
        {/* 编辑歌名 */}
        <div style={{ marginBottom: 24 }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>编辑歌名</Text>
          <div style={{ display: 'flex', gap: 8 }}>
            <Input
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              style={{ flex: 1 }}
              placeholder="输入新歌名"
            />
            <Button type="primary" onClick={handleRename} loading={renaming}>
              保存
            </Button>
          </div>
        </div>
        {/* 多列显示 */}
        <div style={{ marginBottom: 24 }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>同时展示列数</Text>
          <Select
            value={autoColumns ? 'auto' : String(columns)}
            onChange={(value) => {
              if (value === 'auto') {
                setAutoColumns(true);
                setColumns(getColumnsByViewport(window.innerWidth, window.innerHeight));
              } else {
                setColumns(Number(value));
                setAutoColumns(false);
              }
            }}
            style={{ width: '100%' }}
            options={[
              { value: 'auto', label: '自动适配' },
              { value: '1', label: '1 列' },
              { value: '2', label: '2 列' },
              { value: '3', label: '3 列' },
              { value: '4', label: '4 列' },
              { value: '5', label: '5 列' },
              { value: '6', label: '6 列' },
            ]}
          />
        </div>
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

        {/* 操作按钮 */}
        <Space>
          {selectedImages.length > 0 && (
            <Button danger onClick={handleClearImages}>
              清空所有图片
            </Button>
          )}
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
function SortableImageItem({ url, index }: { url: string; index: number }) {
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
    <div ref={setNodeRef} style={style} className="sortable-item" {...attributes} {...listeners}>
      <img src={proxyUrl(url)} alt="" style={{ width: 40, height: 50, objectFit: 'contain', flexShrink: 0 }} />
      <Text ellipsis style={{ flex: 1, fontSize: 13 }}>图片 {index + 1}</Text>
      <HolderOutlined style={{ color: '#999' }} />
    </div>
  );
}

// 设置弹窗中的排序列表
function SettingsImageList({ images, onReorder }: { images: string[]; onReorder: (newOrder: string[]) => void }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIndex = images.findIndex((url) => url === active.id);
      const newIndex = images.findIndex((url) => url === over?.id);
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
