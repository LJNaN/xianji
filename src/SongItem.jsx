import React, { memo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { Button } from 'antd';
import { MinusCircleOutlined } from '@ant-design/icons';

const SongItem = memo(({
  song,
  isEditing,
  onSongClick,
  onDelete,
  isDragging,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    id: song.id,
    data: { song },
    disabled: !isEditing,
  });

  const style = {
    transform: transform ? `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)` : undefined,
    transition: isDragging ? 'none' : transition,
    cursor: isEditing ? 'grab' : 'pointer',
    position: 'relative',
    touchAction: isEditing ? 'none' : 'auto',
    userSelect: isEditing ? 'none' : 'auto',
    WebkitUserSelect: isEditing ? 'none' : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      <Button
        size="large"
        onClick={() => !isEditing && onSongClick(song.name)}
        style={{
          width: '100%',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {song.name}
      </Button>

      {isEditing && (
        <Button
          type="text"
          icon={<MinusCircleOutlined style={{ color: '#ff4d4f' }} />}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(song.name);
          }}
          style={{
            position: 'absolute',
            top: '-8px',
            right: '-8px',
            width: '24px',
            height: '24px',
            padding: '0',
            borderRadius: '50%',
            background: 'white',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            zIndex: 10,
          }}
        />
      )}

      {song.imgUrl && song.imgUrl.length > 0 && (
        <div className="green-dot" />
      )}
    </div>
  );
});

export default SongItem;