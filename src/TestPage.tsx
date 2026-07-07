import React, { useState, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, Card, Typography } from 'antd';
import { HeartOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface Item {
  id: string;
  text: string;
}

// 拖拽项组件（使用 dnd-kit）
function DraggableItem({ id, text, isDragging }: { id: string; text: string; isDragging: boolean }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
    opacity: isDragging ? 0.6 : 1,
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)' as const,
    borderRadius: '12px',
    padding: '16px',
    margin: '8px 0',
    backgroundColor: '#fff',
    cursor: 'grab',
    border: '1px solid #e8e8e8',
    touchAction: 'none',
    zIndex: isDragging ? 100 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <HeartOutlined style={{ color: '#ff4d4f', fontSize: '18px' }} />
        <Text strong>{text}</Text>
        <Text type="secondary" style={{ marginLeft: 'auto' }}>
          ID: {id}
        </Text>
      </div>
    </div>
  );
}

// 主测试页面
const TestPage = () => {
  const [items, setItems] = useState<Item[]>([
    { id: '1', text: '拖拽我试试 🎸' },
    { id: '2', text: '我可以移动位置 ✨' },
    { id: '3', text: '动画很流畅吧？ 💫' },
    { id: '4', text: '试试拖到其他位置 🔄' },
    { id: '5', text: '享受拖拽乐趣！ 😊' },
  ]);
  const [activeId, setActiveId] = useState<string | null>(null);

  // dnd-kit 传感器配置（移动端优化）
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 0,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;

    if (active.id !== over?.id) {
      setItems((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over!.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }, []);

  const resetItems = () => {
    setItems([
      { id: '1', text: '拖拽我试试 🎸' },
      { id: '2', text: '我可以移动位置 ✨' },
      { id: '3', text: '动画很流畅吧？ 💫' },
      { id: '4', text: '试试拖到其他位置 🔄' },
      { id: '5', text: '享受拖拽乐趣！ 😊' },
    ]);
  };

  const activeItem = items.find((item) => item.id === activeId);

  return (
    <div style={{
      padding: '24px',
      maxWidth: '800px',
      margin: '0 auto',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f5f7fa 0%, #e4edf5 100%)'
    }}>
      <Card style={{
        borderRadius: '16px',
        boxShadow: '0 12px 32px rgba(0,0,0,0.1)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '24px', fontSize: 24, fontWeight: 700, color: '#389e0d' }}>
          🎯 React DnD 动画测试 Demo
        </div>

        <div style={{
          textAlign: 'center',
          marginBottom: '24px',
          padding: '16px',
          backgroundColor: '#f6ffed',
          borderRadius: '12px',
          border: '1px solid #b7eb8f'
        }}>
          <Text style={{ fontSize: '16px', color: '#389e0d' }}>
            💡 拖拽任意卡片体验流畅动画效果！
          </Text>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items.map(i => i.id)}
            strategy={verticalListSortingStrategy}
          >
            <div style={{ marginBottom: '24px' }}>
              {items.map((item) => (
                <DraggableItem
                  key={item.id}
                  id={item.id}
                  text={item.text}
                  isDragging={activeId === item.id}
                />
              ))}
            </div>
          </SortableContext>

          <DragOverlay>
            {activeItem ? (
              <div style={{
                boxShadow: '0 12px 30px rgba(0,0,0,0.3)',
                borderRadius: '12px',
                padding: '16px',
                backgroundColor: '#fff',
                cursor: 'grabbing',
                touchAction: 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <HeartOutlined style={{ color: '#ff4d4f', fontSize: '18px' }} />
                  <Text strong>{activeItem.text}</Text>
                  <Text type="secondary" style={{ marginLeft: 'auto' }}>
                    ID: {activeItem.id}
                  </Text>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        <div style={{ textAlign: 'center' }}>
          <Button
            type="primary"
            onClick={resetItems}
            style={{
              backgroundColor: '#389e0d',
              borderColor: '#389e0d'
            }}
          >
            重置顺序
          </Button>
        </div>
      </Card>

      <div style={{
        textAlign: 'center',
        marginTop: '24px',
        color: '#666'
      }}>
        <Text>✨ 基于 @dnd-kit + Ant Design 的专业拖拽体验</Text>
      </div>
    </div>
  );
};

export default TestPage;
