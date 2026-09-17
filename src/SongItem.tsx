import React, { memo } from 'react';
import { Button } from 'antd';
import { MinusCircleOutlined, HeartFilled } from '@ant-design/icons';
import type { Song } from './types';
import type { SongColor } from './songColors';

interface SongItemProps {
  song: Song;
  favorite: boolean;
  isEditing?: boolean;
  color?: SongColor;
  onSongClick: (name: string) => void;
  onDelete?: (name: string) => void;
  onToggleFavorite: (name: string) => void;
}

const SongItem = memo<SongItemProps>(({
  song,
  favorite,
  isEditing,
  color,
  onSongClick,
  onDelete,
  onToggleFavorite,
}) => {
  return (
    <div style={{ position: 'relative' }}>
      <Button
        size="large"
        onClick={() => onSongClick(song.name)}
        className={color ? 'song-btn' : undefined}
        style={{
          width: '100%',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          ...(color && {
            '--song-bg-l': color.lightBg,
            '--song-bg-d': color.darkBg,
          } as React.CSSProperties),
        }}
      >
        {song.name}
      </Button>

      {isEditing && (
        <Button
          type="text"
          icon={<MinusCircleOutlined style={{ color: '#ff4d4f' }} />}
          className="delete-btn"
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.(song.name);
          }}
          style={{
            position: 'absolute',
            top: '-8px',
            right: '-8px',
            width: '24px',
            height: '24px',
            padding: '0',
            borderRadius: '50%',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            zIndex: 10,
          }}
        />
      )}

      {favorite && (
        <HeartFilled
          style={{
            position: 'absolute',
            bottom: 3,
            left: 3,
            fontSize: 8,
            color: '#e8453c',
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
