# Container Deployment Specification

## Purpose
Define the Docker container deployment architecture for the guitar tab management application, including service orchestration, networking, and volume management.

## Requirements

### Requirement: Service Orchestration
The system SHALL provide a docker-compose.yml that orchestrates three services: frontend (Nginx SPA), backend (Express API), and backup (scheduled cron).

#### Scenario: Start all services
- WHEN `docker compose up -d` is executed from the project root
- THEN three containers are created and started
- AND the frontend is accessible at http://localhost/guitar/
- AND API requests to /guitar-api/ are proxied to the backend

#### Scenario: Service dependencies
- GIVEN docker-compose.yml defines service dependencies
- WHEN `docker compose up` is executed
- THEN the frontend container starts after the backend container is ready

#### Scenario: Container restart policy
- GIVEN a container exits unexpectedly
- WHEN the exit is not caused by the user stopping it
- THEN the container is automatically restarted unless-stopped

### Requirement: Frontend Container
The frontend SHALL be built as a multi-stage Docker image with Vite build and Nginx serving.

#### Scenario: Multi-stage build
- GIVEN the Dockerfile at the project root
- WHEN `docker compose build frontend` is executed
- THEN the first stage installs dependencies and runs `vite build`
- AND the second stage copies the dist output to an nginx:alpine image
- AND the final image contains only the nginx configuration and built assets

#### Scenario: SPA routing
- GIVEN the Nginx server is running
- WHEN a request is made to a non-file SPA route under /guitar/ (e.g., /guitar/detail/songname)
- THEN Nginx serves /guitar/index.html for client-side routing
- AND 404 is not returned for valid SPA routes

### Requirement: Backend Container
The backend SHALL run the Express API server in a Node.js container with persistent data volumes.

#### Scenario: API accessibility
- GIVEN the backend container is running
- WHEN a GET request is sent to http://backend:5000/guitar-api/songs
- THEN the API returns the song list from the mounted song_list.json

#### Scenario: Data persistence via bind mount
- GIVEN the backend container is stopped and removed
- WHEN a new backend container starts with the same volume mounts
- THEN all song data and uploaded images are still available

### Requirement: Nginx Reverse Proxy
The Nginx configuration SHALL proxy API and image requests to the backend service.

#### Scenario: API proxy
- GIVEN the frontend Nginx receives a request for /guitar-api/songs
- WHEN the request is proxied to the backend
- THEN the backend receives the request at /guitar-api/songs
- AND the response is returned to the client

#### Scenario: Image proxy
- GIVEN the frontend Nginx receives a request for /guitar-images/foo.png
- WHEN the request is proxied to the backend
- THEN the backend serves the file from the images directory
- AND the response includes Cache-Control header for client-side caching

#### Scenario: File upload size limit
- GIVEN a file upload request to /guitar-api/tabs/{name}/upload
- WHEN the file size does not exceed 50MB
- THEN Nginx allows the request to pass through to the backend
