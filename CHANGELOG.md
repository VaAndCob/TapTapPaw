# Changelog

All notable changes to this project will be documented in this file.

## Unreleased
- Added: Fahrenheit option and Invert Display Colors toggle (desktop tray menu, saved on device; defaults in `app_config.h`)
- Added: physical MX key inputs on CN1/P3 (see docs/KEYS_WIRING.md)
- Fixed: sub-zero temperatures displayed as 2xx values
- Fixed: resistive touch boards now run calibration on first boot when none is saved (previously only when BOOT was held at power-up)
- Added: tap the weather panel on the device to toggle C/F
- Fixed: `npm install` in app/ failed because `postinstall` called an undeclared `electron-rebuild`
- Added: DEVELOPMENT.md and scripts/setup-dev.sh

The format is based on Keep a Changelog, and this project adheres to Semantic Versioning.

## [Unreleased]

## [1.0.5] - 2026-05-24
### Changed
- Faster tap response lower lag
- Update the background + sound effect when climate changed.

## [1.0.4] - 2026-04-24
### Changed
- High cpu usage on windows client app fixed.
- No change on macOS silicon

## [1.0.3] - 2026-02-24
### Added
- Firmware version check packet (host sends 0xFF 0x00; device replies with version string).
- 'Client App' and 'Firmware' new version update notification.

### Changed
- WAV playback volume now follows global volume setting.
- Add connect and disconnect wav sound effects.


## [1.0.2] - 2025-11-19
### Added
- Initial public release.
