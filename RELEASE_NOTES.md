# Spotify Mini Player v1.0.0

A minimalist Spotify mini player widget for Windows 11. No login, OAuth, or API tokens required — it reads playback directly from the Spotify desktop app on your PC.

## Download

- **Windows installer:** `SpotifyMiniPlayer-1.0.0-x64.exe` (NSIS, x64)

## Requirements

- Windows 10/11
- Spotify desktop app installed
- `spotify-cli` available on PATH (or installed alongside Spotify)

## Features

- Compact widget locked to a 392:330 aspect ratio; stays sharp at every size
- Default, Controls, and CD view modes
- Draggable, always-on-top, with tray icon and persistence
- Now playing, progress, transport, volume, queue, search, and playlists
- Offline-aware: keeps last playback when Spotify is closed; surfaces connection status
- Settings sheet with transparency/opacity, view switcher, and CLI status
- Windows light/dark theme fallback

## Notes

- This build uses the widget's built-in default theme (Windows light/dark). Spicetify theme sync is disabled.
- If Spotify is closed at launch, the widget starts in an offline state and reconnects automatically.

## Known limitations

- Requires the Spotify desktop app; web playback is not supported
- Some controls are unavailable while Spotify is closed
