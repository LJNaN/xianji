# Frontend Specification

## Purpose
Define the frontend application structure, routing, component behavior, and user interaction patterns for the guitar tab management app.

## Requirements

### Requirement: Song List Page
The system SHALL display a sortable, searchable list of all songs with drag-and-drop reordering.

#### Scenario: Loading state
- GIVEN the user opens the app
- WHEN the song list is being fetched from the API
- THEN a loading spinner is displayed
- AND the user cannot interact until loading completes

#### Scenario: Display songs
- GIVEN the song list is loaded
- WHEN there are songs in the list
- THEN each song is shown as a clickable card
- AND songs with parsed tabs display a green dot indicator

#### Scenario: Empty state
- GIVEN the song list is loaded
- WHEN no songs exist or search returns no results
- THEN an appropriate empty message is displayed
- AND a button to reset filters is shown

### Requirement: Search and Sort
The user SHALL be able to filter songs by name and sort them by various criteria.

#### Scenario: Search
- GIVEN the user types in the search box
- WHEN the input changes
- THEN the list is filtered to show only matching songs (case-insensitive)

#### Scenario: Sort modes
- GIVEN the user selects a sort mode from the dropdown
- WHEN the sort mode changes
- THEN the song list is reordered accordingly
- AND the sort mode is persisted to localStorage

### Requirement: Drag-and-Drop Reordering
The user SHALL be able to reorder songs via drag-and-drop in edit mode.

#### Scenario: Enter edit mode
- GIVEN the user clicks the "编辑" button
- WHEN edit mode is activated
- THEN the sort mode switches to "自定义排序"
- AND songs become draggable with grab cursor

#### Scenario: Drag and drop
- GIVEN edit mode is active
- WHEN the user drags a song card to a new position
- THEN the list order updates with animation
- AND the new order is saved to the server when the user clicks "完成"

#### Scenario: Drop outside droppable area
- GIVEN a drag operation is in progress
- WHEN the user drops the item outside any droppable target
- THEN no reordering occurs
- AND the item returns to its original position

### Requirement: Song CRUD
The user SHALL be able to add and delete songs.

#### Scenario: Add song
- GIVEN the user clicks the "新增" button
- WHEN a modal appears and the user enters a name and confirms
- THEN the song is created via API
- AND it appears in the song list

#### Scenario: Delete song
- GIVEN edit mode is active
- WHEN the user clicks the delete button on a song card
- THEN a confirmation dialog is shown
- AND if confirmed, the song is deleted via API and removed from the list

### Requirement: Detail Page
The system SHALL provide a detail page for each song to view and manage guitar tab images.

#### Scenario: Navigate to detail
- GIVEN the user is on the song list page
- WHEN the user clicks a song card (not in edit mode)
- THEN the app navigates to `/detail/{songName}`
- AND the detail page shows the song's guitar tab images

#### Scenario: Auto-fetch
- GIVEN the detail page loads for a song without tabs
- WHEN the page mounts
- THEN it automatically searches Bing for "{songName}吉他谱"
- AND presents candidate images for the user to select

#### Scenario: Image viewing
- GIVEN the detail page has images loaded
- WHEN the user views the image grid
- THEN images can be zoomed and panned via pinch/scroll
- AND an auto-scroll feature can be toggled with adjustable speed
- AND the number of display columns adapts to viewport width

### Requirement: Image Fetching
The user SHALL be able to fetch guitar tab images from multiple sources.

#### Scenario: Auto search
- GIVEN the user clicks "自动获取"
- WHEN the API searches Bing and extracts images
- THEN candidate images are displayed as a selection grid
- AND the user can check/uncheck images and save selected ones

#### Scenario: URL input
- GIVEN the user enters a URL containing guitar tab images
- WHEN the user clicks "提取图片"
- THEN the server fetches the page and extracts all img elements
- AND candidate images are displayed for selection

#### Scenario: Local upload
- GIVEN the user clicks "本地上传"
- WHEN a file picker opens and the user selects image files
- THEN files are uploaded to the server
- AND appended to the song's image list
