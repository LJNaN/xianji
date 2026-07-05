# Dark Mode Specification

## Purpose
Define the dark mode behavior, theme options, and visual adaptations for the guitar tab management app.

## Requirements

### Requirement: Dark mode toggle

The system SHALL provide a dark mode with three options: light, dark, and follow-system.

#### Scenario: Switch to dark mode
- **WHEN** user selects "深色" in global settings
- **THEN** the UI switches to dark theme immediately
- **AND** all Ant Design components use dark color scheme
- **AND** custom CSS applies dark background and text colors
- **AND** guitar tab images are inverted to black-on-white

#### Scenario: Follow system preference
- **WHEN** user selects "跟随系统" and the OS switches to dark mode
- **THEN** the UI switches to dark theme automatically

#### Scenario: Persist theme preference
- **WHEN** user selects a theme option
- **THEN** the preference is saved to localStorage
- **AND** restored on next page visit

#### Scenario: Theme preserved across routes
- **WHEN** user navigates or refreshes on any route
- **THEN** the correct theme is applied

### Requirement: Image inversion in dark mode

The system SHALL invert guitar tab images in dark mode for readability.

#### Scenario: Tab image inverted
- **WHEN** dark mode is active and a tab image is displayed
- **THEN** the image has CSS filter invert(1) hue-rotate(180deg) grayscale(1) applied
- **AND** white backgrounds become dark, dark text becomes white
