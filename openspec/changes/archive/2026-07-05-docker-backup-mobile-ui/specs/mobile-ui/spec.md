# Mobile UI Specification

## Purpose
Define responsive UI optimizations for mobile devices, including candidate image selector sizing and home page song list spacing.

## Requirements

### Requirement: Responsive Candidate Image Selector
The candidate image selector SHALL adapt image sizes based on viewport width for optimal mobile display.

#### Scenario: Desktop image display
- GIVEN a viewport width greater than 600px
- WHEN candidate guitar tab images are displayed in the selector
- THEN each image is displayed at 200px width and 250px height

#### Scenario: Mobile image display
- GIVEN a viewport width of 600px or less
- WHEN candidate guitar tab images are displayed in the selector
- THEN each image is scaled down to 140px width and 180px height
- AND images still maintain object-fit: contain behavior

#### Scenario: Image selection interaction
- GIVEN candidate images are displayed in the selector
- WHEN a user taps/clicks an image
- THEN the image is toggled as selected with a green border indicator
- AND a checkbox overlay reflects the selection state

### Requirement: Mobile Song List Spacing
The home page song grid SHALL provide adequate vertical spacing between song items on mobile devices.

#### Scenario: Default mobile spacing
- GIVEN a viewport width of 480px or less
- WHEN the song list is displayed on the home page
- THEN the gap between song items is 10px
- AND song button text remains readable without overflow
