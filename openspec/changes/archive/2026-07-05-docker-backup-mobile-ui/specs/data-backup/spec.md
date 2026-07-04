# Data Backup Specification

## Purpose
Define the automated backup mechanism for the guitar tab management application, covering song_list.json daily backups and images directory weekly backups with automatic cleanup.

## Requirements

### Requirement: Daily JSON Backup
The system SHALL create a daily backup of the song_list.json file.

#### Scenario: Daily backup execution
- GIVEN the backup container is running
- WHEN the scheduled time (daily at 09:00 Asia/Shanghai) is reached
- THEN the backup script copies song_list.json to the backups directory
- AND the backup file is named using the format song_list_YYYY-MM-DD.json

#### Scenario: Manual backup trigger
- GIVEN the backup container is running
- WHEN a user executes `docker compose exec backup /app/backup.sh`
- THEN a new backup of song_list.json is created immediately

### Requirement: Weekly Image Backup
The system SHALL create a weekly compressed archive of the images directory.

#### Scenario: Monday backup
- GIVEN the current day is Monday
- WHEN the daily backup script runs
- THEN the images directory is additionally packaged into a zip archive
- AND the zip file is named using the format images_YYYY-WW.zip

#### Scenario: Non-Monday skip
- GIVEN the current day is not Monday
- WHEN the daily backup script runs
- THEN only song_list.json is backed up
- AND no images zip is created

#### Scenario: Weekly idempotency
- GIVEN a weekly backup zip already exists for the current week
- WHEN the backup script runs on Monday
- THEN the existing zip file is not overwritten
- AND a log message indicates the skip

### Requirement: Backup Cleanup
The system SHALL automatically remove outdated backups to prevent disk space exhaustion.

#### Scenario: Old JSON cleanup
- GIVEN song_list.json backup files older than 90 days exist in the backups directory
- WHEN the backup script runs
- THEN those old backup files are automatically deleted

#### Scenario: Old image cleanup
- GIVEN images zip files older than 180 days exist in the backups directory
- WHEN the backup script runs
- THEN those old zip files are automatically deleted
