## ADDED Requirements

### Requirement: Empty state display when no images exist
When a song detail page has no guitar tab images (`imgUrl` is empty or absent), the system SHALL display an empty state instead of automatically fetching images.

#### Scenario: Enter detail page without images
- **WHEN** user navigates to a song detail page that has no `imgUrl`
- **THEN** the page SHALL display a centered empty state with a guitar emoji, "暂无吉他谱，试试以下方式添加" message, and action buttons
- **AND** the system SHALL NOT automatically call any image-fetching API

#### Scenario: Enter detail page with images
- **WHEN** user navigates to a song detail page that has `imgUrl` with one or more entries
- **THEN** the page SHALL display the images directly without showing the empty state

### Requirement: Manual fetch actions from empty state
The empty state SHALL provide four manual actions for adding guitar tab images.

#### Scenario: Auto-fetch button click
- **WHEN** user clicks "自动获取" button in the empty state
- **THEN** the system SHALL start the auto-fetch process with retry logic

#### Scenario: Bing search button click
- **WHEN** user clicks "去 Bing 搜索" button in the empty state
- **THEN** the system SHALL open a new browser tab to Bing search results for the song name + "吉他谱"

#### Scenario: Local upload button click
- **WHEN** user clicks "本地上传" button in the empty state
- **THEN** the system SHALL open a file picker dialog accepting image files

#### Scenario: URL input for image extraction
- **WHEN** user enters a URL in the input field and clicks "提取"
- **THEN** the system SHALL fetch the URL and extract candidate images from it
