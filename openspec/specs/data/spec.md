# Data Specification

## Purpose
Define the data model, storage format, and constraints for the guitar tab management system.

## Requirements

### Requirement: Song Data Model
Each song SHALL be represented as a JSON object with name, image URLs, and optional creation timestamp.

#### Scenario: Song creation
- GIVEN a new song is created via the API
- WHEN the song object is constructed
- THEN it contains a `name` field (string, required, unique)
- AND an `imgUrl` field (array of strings, default empty)
- AND a `createdAt` field (ISO 8601 string, set when first tabs are added)

#### Scenario: Song without tabs
- GIVEN a song with no guitar tab images
- WHEN the data is loaded
- THEN imgUrl is an empty array
- AND createdAt may be null if no tabs were ever added

### Requirement: Name Uniqueness
The song name SHALL be unique within the song list.

#### Scenario: Duplicate name rejection
- GIVEN a song named "晴天" already exists
- WHEN a user attempts to create another song named "晴天"
- THEN the API returns a 409 Conflict error
- AND the existing song is not modified

#### Scenario: Rename conflict
- GIVEN a song named "A" exists and a song named "B" exists
- WHEN a user attempts to rename "A" to "B"
- THEN the API returns a 409 Conflict error
- AND neither song is modified

### Requirement: Image Storage Format
Each image file SHALL be stored with a UUID-based filename and an appropriate extension.

#### Scenario: File naming
- GIVEN an image is downloaded or uploaded
- WHEN the file is saved to disk
- THEN the filename is a randomly generated UUID v4
- AND the extension matches the image content type (jpg, png, gif, webp)

#### Scenario: File size limit
- GIVEN a user uploads a file
- WHEN the file exceeds 10MB
- THEN the upload is rejected by the Multer middleware
