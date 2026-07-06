## MODIFIED Requirements

### Requirement: Song Data Model
Each song SHALL be represented as a JSON object with name, image URLs, and optional creation timestamp, stored in a SQLite database.

#### Scenario: Song creation
- GIVEN a new song is created via the API
- WHEN the song object is saved to the database
- THEN it contains a `name` field (string, required, unique)
- AND an `imgUrl` field (array of strings, default empty)
- AND a `createdAt` field (ISO 8601 string, set when first tabs are added)

#### Scenario: Song without tabs
- GIVEN a song with no guitar tab images
- WHEN the data is loaded
- THEN imgUrl is an empty array
- AND createdAt may be null if no tabs were ever added
