'use strict';

const APP_NAME = 'Spotify Mini Player';
const APP_ID = 'com.example.spotifyminiplayer';

const WINDOW = Object.freeze({
  width: 392,
  height: 330,
  defaultOpacity: 0.92,
  minOpacity: 0.55,
});

const POLL_INTERVAL_MS = 2000;
const HIDDEN_POLL_INTERVAL_MS = 10000;
const FALLBACK_ACCENT = '#1db954';

module.exports = {
  APP_NAME,
  APP_ID,
  WINDOW,
  POLL_INTERVAL_MS,
  HIDDEN_POLL_INTERVAL_MS,
  FALLBACK_ACCENT,
};
