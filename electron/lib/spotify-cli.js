'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { AppError } = require('./errors');

const DEFAULT_TIMEOUT_MS = 8000;
const MAX_BUFFER = 8 * 1024 * 1024;

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

/**
 * Spotify's desktop app ships a local CLI next to Spotify.exe. It talks to the
 * already-running desktop client, so the widget never needs an OAuth token or
 * a Spotify developer app.
 */
function findSpotifyCli({ env = process.env, isFile = fs.existsSync } = {}) {
  const appData = env.APPDATA || '';
  const localAppData = env.LOCALAPPDATA || '';
  const programFiles = env.ProgramFiles || env.PROGRAMFILES || '';
  const programFilesX86 = env['ProgramFiles(x86)'] || env['PROGRAMFILES(X86)'] || '';

  const candidates = uniq([
    env.SPOTIFY_CLI_PATH,
    appData && path.join(appData, 'Spotify', 'spotify_cli.exe'),
    localAppData && path.join(localAppData, 'Spotify', 'spotify_cli.exe'),
    localAppData && path.join(localAppData, 'Programs', 'Spotify', 'spotify_cli.exe'),
    localAppData && path.join(localAppData, 'Microsoft', 'WindowsApps', 'spotify_cli.exe'),
    programFiles && path.join(programFiles, 'Spotify', 'spotify_cli.exe'),
    programFilesX86 && path.join(programFilesX86, 'Spotify', 'spotify_cli.exe'),
  ]);

  return candidates.find((candidate) => {
    try {
      return isFile(candidate);
    } catch {
      return false;
    }
  }) || null;
}

function cleanCliMessage(value) {
  const text = String(value || '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ');

  if (!text) return '';
  return text.length > 260 ? `${text.slice(0, 257)}…` : text;
}

function cliFailure(error, stdout, stderr) {
  const detail = cleanCliMessage(stderr) || cleanCliMessage(stdout);
  const combined = `${detail} ${error?.message || ''}`.toLowerCase();

  if (error?.code === 'ENOENT') {
    return new AppError(
      'SPOTIFY_CLI_MISSING',
      'Spotify desktop was not found. Install or update Spotify, then reopen the widget.',
      { cause: error },
    );
  }

  if (/not logged in|login required|sign in|unauthori[sz]ed/.test(combined)) {
    return new AppError(
      'SPOTIFY_NOT_LOGGED_IN',
      'Sign in to the Spotify desktop app, then try again.',
      { cause: error },
    );
  }

  if (/not running|could not find spotify|spotify is closed|no active (?:device|session)/.test(combined)) {
    return new AppError(
      'SPOTIFY_NOT_RUNNING',
      'Spotify is not running. Open the desktop app to connect.',
      { cause: error },
    );
  }

  return new AppError(
    'SPOTIFY_CLI_FAILED',
    detail ? `Spotify could not complete that request: ${detail}` : 'Spotify could not complete that request.',
    { cause: error },
  );
}

function runSpotifyCli(cliPath, args, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      cliPath,
      args,
      {
        windowsHide: true,
        timeout: timeoutMs,
        maxBuffer: MAX_BUFFER,
        encoding: 'utf8',
      },
      (error, stdout, stderr) => {
        if (!error) {
          resolve(String(stdout || ''));
          return;
        }

        if (error.killed || error.code === 'ETIMEDOUT' || error.signal) {
          reject(
            new AppError(
              'SPOTIFY_TIMEOUT',
              'Spotify took too long to respond. Try again.',
              { cause: error },
            ),
          );
          return;
        }

        reject(cliFailure(error, stdout, stderr));
      },
    );
  });
}

function extractJson(text) {
  // Accept values that were already parsed so callers can chain the CLI runner
  // and a parser without double-decoding the same response.
  if (text !== null && typeof text === 'object') return text;

  const raw = String(text || '').trim();
  if (!raw) {
    throw new AppError('SPOTIFY_BAD_RESPONSE', 'Spotify returned an empty response.');
  }

  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1));
      } catch {
        // Fall through to the friendly error below.
      }
    }
    throw new AppError('SPOTIFY_BAD_RESPONSE', 'Spotify returned an unreadable response.');
  }
}

function splitDescription(description) {
  const text = String(description || '').trim();
  if (!text) return { title: '', artist: '' };

  const emDash = text.lastIndexOf(' — ');
  if (emDash > 0) {
    return {
      title: text.slice(0, emDash).trim(),
      artist: text.slice(emDash + 3).trim(),
    };
  }

  const spacedDash = text.lastIndexOf(' - ');
  if (spacedDash > 0) {
    return {
      title: text.slice(0, spacedDash).trim(),
      artist: text.slice(spacedDash + 3).trim(),
    };
  }

  return { title: text, artist: '' };
}

// Spotify CDN image URLs carry a size marker. Full-bleed artwork needs the
// largest variant, otherwise a 64px thumbnail gets stretched across the card.
function upscaleImageUrl(url) {
  return String(url || '')
    .replace('/ab67616d00004851', '/ab67616d0000b273')
    .replace('/ab67616d00001e02', '/ab67616d0000b273')
    .replace('/ab6761610000f178', '/ab6761610000e5eb')
    .replace('https://mosaic.scdn.co/300/', 'https://mosaic.scdn.co/640/')
    .replace('https://mosaic.scdn.co/60/', 'https://mosaic.scdn.co/640/');
}

function normalizeImageUrl(value, { large = false } = {}) {
  const image = String(value || '').trim();
  if (!image) return '';

  let normalized = '';
  if (image.startsWith('spotify:image:')) {
    normalized = `https://i.scdn.co/image/${image.slice('spotify:image:'.length)}`;
  } else if (/^https?:\/\//i.test(image)) {
    normalized = image;
  }

  return large ? upscaleImageUrl(normalized) : normalized;
}

function parseNowPlayingJson(text) {
  const data = extractJson(text);
  const current = data?.currently_playing;

  if (!current || typeof current.uri !== 'string' || !current.uri.startsWith('spotify:')) {
    return { current: null };
  }

  const fallback = splitDescription(current.description);
  return {
    current: {
      uri: current.uri,
      title: current.name || fallback.title,
      artist: current.artist || fallback.artist,
      context: String(current.context_description || ''),
      isPlaying: Boolean(current.is_playing ?? data.is_playing),
    },
  };
}

function readDuration(metadata) {
  if (!Array.isArray(metadata)) return 0;
  const entry = metadata.find((item) => item && item.field === 'duration');
  const value = Number(entry?.value);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}

function normalizeEntity(entity) {
  if (!entity || typeof entity.uri !== 'string') return null;

  const artists = Array.isArray(entity.contributors)
    ? entity.contributors
        .map((artist) => (artist && typeof artist.name === 'string' ? artist.name : ''))
        .filter(Boolean)
    : [];

  return {
    uri: entity.uri,
    title: String(entity.name || ''),
    artist: artists.join(', '),
    album: String(entity.parent?.name || ''),
    albumArt: normalizeImageUrl(entity.image_url, { large: true }),
    durationMs: readDuration(entity.metadata),
  };
}

function parseLookupJson(text) {
  const data = extractJson(text);
  const entities = Array.isArray(data?.entities) ? data.entities : [];
  return entities.map(normalizeEntity).filter(Boolean);
}

function parseQueueJson(text) {
  const data = extractJson(text);
  const upcoming = Array.isArray(data?.next_tracks) ? data.next_tracks : [];

  return {
    upcoming: upcoming
      .filter((track) => track && typeof track.uri === 'string')
      .map((track) => ({
        uri: track.uri,
        title: String(track.name || ''),
        artist: String(track.artist || ''),
        album: '',
        albumArt: '',
        durationMs: 0,
      })),
    revision: data?.revision ?? null,
  };
}

const SEARCH_TYPES = new Set(['track', 'album', 'artist', 'playlist']);

function normalizeSearchItem(entity, kind) {
  return {
    kind,
    uri: entity.uri,
    title: String(entity.name || ''),
    artist: Array.isArray(entity.artists)
      ? entity.artists.filter(Boolean).join(', ')
      : String(entity.author || ''),
    album: '',
    albumArt: normalizeImageUrl(entity.image),
    durationMs: 0,
  };
}

function parseSearchJson(text, type = 'track') {
  const data = extractJson(text);
  const kind = SEARCH_TYPES.has(type) ? type : 'track';
  const bucket = `${kind}s`;
  const items = Array.isArray(data?.[bucket]) ? data[bucket] : [];

  return items
    .filter((item) => (
      item &&
      typeof item.uri === 'string' &&
      item.uri.startsWith(`spotify:${kind}:`)
    ))
    .map((item) => normalizeSearchItem(item, kind));
}

function parsePlaylistListJson(text) {
  const data = extractJson(text);
  const items = Array.isArray(data?.items) ? data.items : [];

  return items
    .filter((item) => (
      item &&
      item.type === 'playlist' &&
      typeof item.uri === 'string' &&
      item.uri.startsWith('spotify:playlist:')
    ))
    .map((item) => ({
      uri: item.uri,
      name: String(item.name || ''),
    }));
}

function parsePlaylistJson(text) {
  const data = extractJson(text);
  const tracks = Array.isArray(data?.tracks) ? data.tracks : [];

  return {
    uri: String(data?.uri || ''),
    name: String(data?.name || ''),
    description: String(data?.description || ''),
    trackCount: Number(data?.track_count) || tracks.length,
    tracks: tracks
      .filter((track) => track && typeof track.uri === 'string')
      .map((track, index) => ({
        uri: track.uri,
        title: String(track.name || ''),
        artist: Array.isArray(track.artists) ? track.artists.filter(Boolean).join(', ') : '',
        album: String(track.album || ''),
        albumArt: '',
        durationMs: 0,
        position: Number.isFinite(Number(track.position)) ? Number(track.position) : index,
      })),
  };
}

function parseDeviceListJson(text) {
  const data = extractJson(text);
  const devices = Array.isArray(data?.devices) ? data.devices : [];
  const active =
    devices.find((device) => device && device.device_id === data?.active_device_id) ||
    devices.find((device) => device && device.is_active) ||
    // When playback is paused, Spotify may mark every device inactive. The
    // local desktop app can still be controlled, so use it as a fallback.
    devices.find((device) => device && device.is_self) ||
    devices.find((device) => device && device.is_local) ||
    null;

  if (!active) return null;

  const volume = Number(active.volume);
  return {
    id: String(active.device_id || ''),
    name: String(active.name || 'Spotify device'),
    type: String(active.device_type || ''),
    volumePercent: Number.isFinite(volume) ? Math.min(100, Math.max(0, Math.round(volume))) : null,
    isRestricted: Boolean(active.capabilities?.disable_volume),
  };
}

function parseStatusJson(text) {
  const data = extractJson(text);
  return {
    running: Boolean(data?.running),
    loggedIn: Boolean(data?.logged_in),
  };
}

function parseVersionOutput(text) {
  const match = String(text || '').match(/^cli:\s*(\S+)/im);
  return match ? match[1] : '';
}

module.exports = {
  DEFAULT_TIMEOUT_MS,
  findSpotifyCli,
  runSpotifyCli,
  extractJson,
  splitDescription,
  normalizeImageUrl,
  upscaleImageUrl,
  parseNowPlayingJson,
  parseLookupJson,
  parseQueueJson,
  parseSearchJson,
  parsePlaylistListJson,
  parsePlaylistJson,
  parseDeviceListJson,
  parseStatusJson,
  parseVersionOutput,
  cleanCliMessage,
};
