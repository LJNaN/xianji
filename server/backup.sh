#!/bin/bash
# 备份脚本 - song_list.json 每日备份，images 每周备份

BACKUP_DIR="$(cd "$(dirname "$0")" && pwd)/backups"
DATA_FILE="$(cd "$(dirname "$0")" && pwd)/song_list.json"
IMAGE_DIR="$(cd "$(dirname "$0")" && pwd)/images"

mkdir -p "$BACKUP_DIR"

DATE=$(date +%Y-%m-%d)
WEEK=$(date +%Y-%V)

# 每日备份 song_list.json
cp "$DATA_FILE" "$BACKUP_DIR/song_list_$DATE.json"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] song_list backed up: song_list_$DATE.json"

# 每周备份 images（只在周一执行）
DOW=$(date +%u)  # 1=周一, 7=周日
if [ "$DOW" = "1" ]; then
  ZIP_NAME="$BACKUP_DIR/images_$WEEK.zip"
  if [ ! -f "$ZIP_NAME" ]; then
    cd "$(dirname "$IMAGE_DIR")"
    zip -r "$ZIP_NAME" "images" -x "node_modules/*" > /dev/null 2>&1
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] images backed up: images_$WEEK.zip"
  else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] images_$WEEK.zip already exists, skipping"
  fi
fi

# 清理超过 90 天的 song_list 备份和超过 180 天的 images 备份
find "$BACKUP_DIR" -name "song_list_*.json" -mtime +90 -delete 2>/dev/null
find "$BACKUP_DIR" -name "images_*.zip" -mtime +180 -delete 2>/dev/null
echo "[$(date '+%Y-%m-%d %H:%M:%S')] old backups cleaned up"
