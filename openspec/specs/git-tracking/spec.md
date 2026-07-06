# Git Tracking Specification

## Purpose
Define the repository's git file tracking strategy for environment configuration, runtime data, and asset directories.

## Requirements

### Requirement: Environment Variable Template

The repository SHALL provide a `.env.example` file documenting required environment variables.

#### Scenario: .env.example exists
- WHEN the repository is cloned
- THEN a `.env.example` file exists in the project root
- AND it contains the key name `DEEPSEEK_KEY`
- AND it contains instructions for obtaining the key

#### Scenario: .env is not tracked
- WHEN `git ls-files` is executed
- THEN `.env` is NOT listed as a tracked file
- AND `.env` is listed in `.gitignore`

### Requirement: Image Directory Placeholder

The `server/images/` directory SHALL be tracked in git as an empty directory placeholder.

#### Scenario: .gitkeep tracked
- WHEN `git ls-files` is executed
- THEN `server/images/.gitkeep` is listed as a tracked file
- AND no other files in `server/images/` are tracked

#### Scenario: Runtime images not tracked
- WHEN a runtime image file is added to `server/images/`
- THEN it is NOT shown as an untracked file in `git status`
- AND it is NOT automatically included in commits

### Requirement: Runtime Data Files Protection

The runtime data files `server/song_list.json` and `server/visits.json` SHALL be tracked in git as empty arrays, with a mechanism to prevent `git pull` from overwriting production data.

#### Scenario: Committed as empty array
- WHEN the repository is cloned
- THEN `server/song_list.json` contains `[]`
- AND `server/visits.json` contains `[]`

#### Scenario: Production data not overwritten
- GIVEN `server/song_list.json` contains production data
- AND `git update-index --skip-worktree server/song_list.json` has been executed
- WHEN `git pull` is executed
- THEN the production data in `server/song_list.json` is NOT modified
