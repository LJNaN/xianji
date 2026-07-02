# Architecture Specification

## Purpose
Define the overall architecture, project structure, and deployment model of the guitar tab management application "弦集". The system follows an SPA + REST API separation pattern with a React frontend and Express backend.

## Requirements

### Requirement: Frontend-Backend Separation
The frontend and backend SHALL be deployed as separate processes during development and as a unified static-serving application in production.

#### Scenario: Development mode
- GIVEN the developer runs `npm run dev` in the project root
- WHEN the Vite dev server starts on port 5174
- THEN API requests to `/guitar-api/*` are proxied to Express on port 5000
- AND image requests to `/guitar-images/*` are proxied to Express on port 5000

#### Scenario: Production mode
- GIVEN the frontend is built via `npm run build`
- WHEN Express starts and detects the `dist/` directory
- THEN Express serves all static files from `dist/`
- AND all non-API requests fall back to `dist/index.html` for SPA routing

### Requirement: Data Storage
The system SHALL persist data using a JSON file without external database dependencies.

#### Scenario: Data persistence
- GIVEN the server is running
- WHEN a song is created or modified
- THEN the changes are written to `server/song_list.json`
- AND the file is readable on subsequent server starts

### Requirement: Image Management
The system SHALL store downloaded guitar tab images in a local directory with UUID-based filenames.

#### Scenario: Image download
- GIVEN a user selects candidate images from the web
- WHEN the system downloads images via the save endpoint
- THEN each image is saved to `server/images/` with a random UUID filename
- AND the image URL is stored as `/guitar-images/{uuid}.{ext}`

#### Scenario: Supported formats
- GIVEN an image URL with extension jpg, jpeg, png, gif, or webp
- WHEN the system processes the image
- THEN the image is accepted and downloaded
- AND files exceeding 10MB are rejected
