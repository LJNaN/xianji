## ADDED Requirements

### Requirement: Auto-fetch with retry and error reporting
The system SHALL attempt to fetch guitar tab images from multiple search results with detailed per-attempt error reporting.

#### Scenario: Multiple search attempts
- **WHEN** user clicks "自动获取" button
- **THEN** backend searches Bing for up to 5 results
- **THEN** backend attempts each result sequentially with 1-second interval between attempts
- **THEN** each attempt has a 5-second timeout
- **THEN** if all attempts fail, backend returns 404 with `details` array containing each URL and its error reason

#### Scenario: Anti-scraping headers
- **WHEN** backend fetches a search result page to extract images
- **THEN** request includes `Referer`, `Accept`, and `Accept-Language` headers matching the target URL's origin

#### Scenario: Detailed error display
- **WHEN** auto-fetch fails on all attempts
- **THEN** frontend displays a warning Alert with the summary and a list of each attempted URL with its specific error
