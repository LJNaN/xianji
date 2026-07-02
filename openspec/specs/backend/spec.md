# Backend Specification

## Purpose
Define the Express API server that powers the guitar tab management system, including song CRUD, image fetching/proxying, and file upload.

## Requirements

### Requirement: Song List CRUD
The API SHALL provide full CRUD operations for managing the song list.

#### Scenario: List all songs
- GIVEN the server is running
- WHEN a GET request is sent to `/guitar-api/songs`
- THEN the response returns a JSON array of all songs
- AND each song includes name, imgUrl array, and createdAt timestamp

#### Scenario: Create song
- GIVEN a POST request with a JSON body containing a name
- WHEN the name is non-empty and does not already exist
- THEN a new song entry is created
- AND a 201 status is returned

#### Scenario: Duplicate name prevention
- GIVEN a POST request with a name that already exists
- WHEN the server processes the request
- THEN a 409 status is returned with an error message

#### Scenario: Delete song
- GIVEN a DELETE request to `/guitar-api/songs/{name}`
- WHEN the song exists
- THEN the song is removed from the list
- AND a success response is returned

### Requirement: Image Proxy
The API SHALL proxy external images to bypass CDN hotlink protection.

#### Scenario: Proxy image request
- GIVEN a GET request to `/guitar-api/proxy-image?url={encodedUrl}`
- WHEN the URL is valid
- THEN the server fetches the image with a browser-like User-Agent and Referer header
- AND streams the image response back to the client

### Requirement: Auto Image Fetch
The API SHALL automatically search for guitar tab images using Bing and extract them from web pages.

#### Scenario: Bing search
- GIVEN a POST request to `/guitar-api/tabs/{name}/auto-fetch`
- WHEN the server searches Bing for "{name}吉他谱"
- THEN it extracts the first result URL
- AND fetches that page to extract image elements

#### Scenario: Image extraction
- GIVEN a page URL is obtained from Bing or provided by the user
- WHEN the server parses the page HTML
- THEN it extracts up to 10 image URLs from img tags (including data-original attributes)
- AND returns them as candidate_images in the response

### Requirement: Image Save and Download
The API SHALL download selected images to the local filesystem.

#### Scenario: Save images
- GIVEN a POST request to `/guitar-api/tabs/{name}/save` with an images array
- WHEN the mode is not "reorder"
- THEN each image URL is downloaded to the server/images/ directory
- AND old local images associated with the song are deleted
- AND the song's imgUrl array is updated with the new local paths

#### Scenario: Reorder images
- GIVEN a POST request with mode "reorder"
- WHEN the images array contains existing local paths
- THEN only the array order is updated
- AND no new downloads occur

### Requirement: File Upload
The API SHALL accept local file uploads for guitar tab images.

#### Scenario: Upload images
- GIVEN a POST request to `/guitar-api/tabs/{name}/upload` with multipart form data
- WHEN the files are valid image types (jpg, png, gif, webp)
- THEN the files are saved to server/images/ with UUID filenames
- AND the song's imgUrl array is updated
- AND a maximum of 10 files per request is enforced

#### Scenario: Invalid file type
- GIVEN an upload request with a non-image file
- WHEN Multer processes the file filter
- THEN the file is rejected with an "不支持的文件格式" error
