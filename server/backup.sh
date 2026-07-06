#!/bin/bash
# 备份脚本 - SQLite 数据库每日备份，images 每周备份

BACKUP_DIR="$(cd "$(dirname "$0")" && pwd)/backups"
DB_DIR="$(cd "$(dirname "$0")" && pwd)/data"
DB_FILE="$DB_DIR/database.sqlite"
IMAGE_DIR="$(cd "$(dirname "$0")" && pwd)/images"

mkdir -p "$BACKUP_DIR"

DATE=$(date +%Y-%m-%d)
WEEK=$(date +%Y-%V)

# 每日备份 SQLite 数据库
if [ -f "$DB_FILE" ]; then
  cp "$DB_FILE" "$BACKUP_DIR/database_$DATE.sqlite"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] database backed up: database_$DATE.sqlite"
fi

# 每周备份 images（同一周只打一次包，手动执行也能触发）
ZIP_NAME="$BACKUP_DIR/images_$WEEK.zip"
if [ ! -f "$ZIP_NAME" ]; then
  cd "$(dirname "$IMAGE_DIR")"
  zip -r "$ZIP_NAME" "images" -x "node_modules/*" > /dev/null 2>&1
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] images backed up: images_$WEEK.zip"
else
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] images_$WEEK.zip already exists, skipping"
fi

# 清理超过 90 天的数据库备份，超过 180 天的 images 备份
find "$BACKUP_DIR" -name "database_*.sqlite" -mtime +90 -delete 2>/dev/null
find "$BACKUP_DIR" -name "images_*.zip" -mtime +180 -delete 2>/dev/null
echo "[$(date '+%Y-%m-%d %H:%M:%S')] old backups cleaned up"
