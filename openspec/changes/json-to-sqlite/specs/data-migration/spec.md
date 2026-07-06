## ADDED Requirements

### Requirement: JSON to SQLite Migration

The server SHALL automatically migrate data from existing JSON files (song_list.json / visits.json) to SQLite on startup.

#### Scenario: Existing JSON found
- GIVEN `song_list.json` exists in the server directory
- WHEN the server starts
- THEN all songs are inserted into the `songs` table
- AND `song_list.json` is renamed to `.song_list.json.bak`
- AND existing data is accessible via API after migration

#### Scenario: Only visits.json found
- GIVEN `visits.json` exists but `song_list.json` does not
- WHEN the server starts
- THEN only visits are migrated
- AND songs table is initialized as empty

#### Scenario: No JSON files found
- GIVEN neither `song_list.json` nor `visits.json` exist
- WHEN the server starts
- THEN the SQLite database is created fresh
- AND songs/visits tables are empty

#### Scenario: Idempotent migration
- GIVEN no JSON files exist (already migrated or fresh install)
- WHEN the server starts
- THEN no migration is attempted
- AND existing SQLite data is not modified

### Requirement: Visits Data Retention

The server SHALL keep at most 30 days of visit records.

#### Scenario: Old visits purged on startup
- GIVEN a visit record with date older than 30 days exists in the visits table
- WHEN the server starts
- THEN that record is deleted from the database

#### Scenario: Recent visits preserved
- GIVEN a visit record from the last 30 days
- WHEN the server starts
- THEN the record remains in the database
