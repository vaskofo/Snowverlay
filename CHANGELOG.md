# Changelog

## [2.4.0] - TBA

### Added
- **UI Icons**: Changed labels to icons for consistency.
- **Dynamic Height**: The overlay height now adjusts based on the number of players displayed (can be toggled in settings).
- **Skill Breakdown**: Added class name, spec and icon.

### Changed
- **Welcome Screen**: Removed most loading messages.
- **Auto-resize Logic**: Improved logic for resizing the overlay when switching screens.

## [2.3.1] - 2025-10-22

### Added

- **Auto release**: Automatically create release builds on tag push.
- **Linting**

## [2.3.0] - 2025-10-22

### Added

- **Project Renamed to Snowverlay**: The project is now called Snowverlay!
- **Skill Details View**: Click any player to see a full breakdown of their skills, including damage, DPS contribution, cast count, and casts per second (CPS).
- **Group Totals Header**: A new sticky header displays the party's total damage, group DPS, and fight duration.
- **Class-Based Colors**: Player bars are now colored by class role (DPS, Tank, Healer), and you're always yellow. You can disable this in the settings for unique colors per player.
- **Global Keyboard Shortcuts**: You can now toggle global hotkeys in settings to move (`Ctrl+Alt+Arrows`) and resize (`Ctrl+Shift+Arrows`) the window.
- **New UI/UX Features**:
    - **Startup Overlay**: A new welcome screen shows the connection status (e.g., "Finding server...").
    - **Configurable Date/Time Format**: Pick your preferred date and time format in settings for the new footer display.
    - **Adjustable Font Size**: Scale the UI between Small, Normal, and Large.
    - **App Version Display**: The app version is now shown in the title bar.
    - **Clear DPS Shortcut**: Added a `Ctrl+Alt+C` hotkey to clear the current session.
- **Auto-clear**: When changing lines or after 15 seconds of team inactivity, the DPS meter will automatically clear.

### Changed

- **UI Overhaul**: Redesigned the UI for a cleaner look and better readability (Inspired by ShinraMeter).
- **Keyboard Shortcut Updates**:
    - Toggle Mouse Pass-through: `Ctrl+Alt+\``
    - Resize Window: `Ctrl+Shift+Arrow Keys`
- **Performance & Stability**:
    - Rewrote server identification logic for faster and more reliable connections.
    - Improved TCP packet handling to prevent errors from bad data.
    - The UI no longer updates while you're hovering over the meter, making it easier to click on players.
- **Settings Management**: The app now saves more of your UI and behavior preferences.

### Fixed

- Fixed a crash on startup caused by out-of-order packets.
- The DPS meter no longer updates in the background when the settings or help menus are open.
- Group DPS is now calculated with a shared timer, so all players are measured against the same fight duration.
