## ADDED Requirements

### Requirement: Visit logging endpoint
The system SHALL record page visits with device identification and user agent information.

#### Scenario: Record visit on page load
- **WHEN** a user opens the app in a browser
- **THEN** frontend sends `POST /guitar-api/visit` with `{ uuid, userAgent }`
- **THEN** backend appends a record to `visits.json` with `date`, `time`, `uuid`, `ip`, `userAgent`

#### Scenario: Persistent device identification
- **WHEN** a user visits the app for the first time
- **THEN** a UUID is generated and stored in `localStorage`
- **THEN** subsequent visits reuse the same UUID

#### Scenario: Non-HTTPS compatibility
- **WHEN** a user accesses the app via HTTP (not HTTPS)
- **THEN** UUID generation SHALL NOT rely on `crypto.randomUUID()`
- **THEN** UUID SHALL be generated using a `Math.random()`-based fallback

#### Scenario: Visit backup
- **WHEN** daily backup runs
- **THEN** `visits.json` is copied to `backups/visits_YYYY-MM-DD.json`
- **THEN** visits backups older than 90 days are deleted
