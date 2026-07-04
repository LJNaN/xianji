## ADDED Requirements

### Requirement: Retry across multiple Bing search results
When auto-fetching guitar tab images, the system SHALL retrieve up to 3 Bing search result URLs and attempt to extract images from each one, sequentially.

#### Scenario: First result succeeds
- **WHEN** auto-fetch is triggered and the first Bing search result URL successfully yields candidate images
- **THEN** the system SHALL return the candidate images immediately without trying remaining URLs

#### Scenario: First result fails, second succeeds
- **WHEN** the first Bing search result URL fails or times out
- **AND** the second result URL successfully yields candidate images
- **THEN** the system SHALL return the candidate images from the second URL

#### Scenario: All three results fail
- **WHEN** all three Bing search result URLs fail to yield candidate images
- **THEN** the system SHALL return a 404 error with a message indicating all attempts failed

### Requirement: Per-attempt timeout
Each individual URL attempt SHALL timeout after 5 seconds and move to the next URL.

#### Scenario: Single URL timeout
- **WHEN** an image extraction request to a URL takes longer than 5 seconds
- **THEN** the system SHALL abort that attempt and proceed to the next URL
- **AND** the timeout SHALL NOT affect subsequent attempts

### Requirement: Total timeout guard
The entire auto-fetch process SHALL have a total timeout of 15 seconds.

#### Scenario: Total time exceeds limit
- **WHEN** the accumulated time across all attempts exceeds 15 seconds
- **THEN** the system SHALL stop trying additional URLs and return failure

### Requirement: Loading state during auto-fetch
While auto-fetch is in progress, the system SHALL show a loading spinner with descriptive text.

#### Scenario: Show loading during fetch
- **WHEN** user clicks "自动获取" and the backend is processing
- **THEN** the empty state SHALL be replaced with a loading spinner and "正在自动搜索" message
- **AND** the user SHALL NOT be able to trigger another auto-fetch until the current one completes

#### Scenario: Auto-fetch failure feedback
- **WHEN** auto-fetch completes with no candidate images found
- **THEN** the system SHALL display an error message in the empty state
- **AND** the user SHALL be able to retry by clicking "重试自动获取"
