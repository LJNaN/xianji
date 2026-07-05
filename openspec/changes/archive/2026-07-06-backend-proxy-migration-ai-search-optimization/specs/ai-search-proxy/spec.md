## ADDED Requirements

### Requirement: AI search via backend proxy
The system SHALL proxy DeepSeek API requests through the backend at `/guitar-api/ai-search` instead of calling DeepSeek directly from the frontend. The API Key SHALL only exist on the server side.

#### Scenario: Search request is proxied
- **WHEN** user types a search term in the AI search input
- **THEN** frontend sends `POST /guitar-api/ai-search` with `{ searchTerm, songNames }` body
- **THEN** backend forwards the request to DeepSeek API with the server-side API Key
- **THEN** backend returns DeepSeek's response to the frontend

#### Scenario: Missing API Key returns error
- **WHEN** `DEEPSEEK_KEY` environment variable is not set
- **THEN** backend returns 500 with error message "AI 搜索未配置（缺少 DEEPSEEK_KEY）"

#### Scenario: Request cancellation on new search
- **WHEN** user types a new search term before the previous request completes
- **THEN** the previous in-flight fetch is aborted via AbortController
- **THEN** only the latest request's response updates the song grid

#### Scenario: Thinking mode disabled
- **WHEN** backend calls DeepSeek API
- **THEN** request body includes `thinking: { type: "disabled" }` to disable reasoning
