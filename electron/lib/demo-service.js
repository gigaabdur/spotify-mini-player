'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { pathToFileURL } = require('node:url');
const { AppError } = require('./errors');

const DEMO_TRACKS = [
  {
    file: 'cover-1.png',
    title: 'Neon Bloom',
    artist: 'Nova Hart',
    album: 'Afterglow',
    durationMs: 3 * 60 * 1000 + 42 * 1000,
    accent: '#1ed760',
  },
  {
    file: 'cover-2.png',
    title: 'Midnight Drive',
    artist: 'The Satellites',
    album: 'Night Signals',
    durationMs: 4 * 60 * 1000 + 8 * 1000,
    accent: '#9a8cff',
  },
  {
    file: 'cover-3.png',
    title: 'Golden Hour',
    artist: 'Mira Vale',
    album: 'City Lights',
    durationMs: 3 * 60 * 1000 + 27 * 1000,
    accent: '#ff9a5a',
  },
  {
    file: 'cover-1.png',
    title: 'Paper Moons',
    artist: 'Iris June',
    album: 'Soft Focus',
    durationMs: 3 * 60 * 1000 + 11 * 1000,
    accent: '#4ecdc4',
  },
  {
    file: 'cover-2.png',
    title: 'Slow Motion',
    artist: 'Kite Club',
    album: 'Long Way Home',
    durationMs: 4 * 60 * 1000 + 21 * 1000,
    accent: '#f78fb3',
  },
  {
    file: 'cover-3.png',
    title: 'After Hours',
    artist: 'Lumen',
    album: 'Nightfall',
    durationMs: 2 * 60 * 1000 + 58 * 1000,
    accent: '#ffd166',
  },
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * A self-contained, offline service used by `npm run demo` and screenshots.
 * It deliberately exposes the same surface as SpotifyService so the renderer
 * does not need any demo-specific branches.
 */
class DemoService extends EventEmitter {
  constructor({ empty = false, offline = false } = {}) {
    super();
    this.empty = empty;
    this.offline = offline;
    this.index = 0;
    this.queue = [1, 2, 3, 4, 5];
    this.isPlaying = true;
    this.progressMs = 38 * 1000;
    this.volume = 72;
    this.visible = true;
    this.closed = false;
    this.updatedAt = Date.now();
    this.timer = null;

    this.tracks = DEMO_TRACKS.map((track, index) => {
      const filePath = path.join(__dirname, '..', '..', 'assets', 'demo', track.file);
      let albumArt = '';
      try {
        if (fs.existsSync(filePath)) {
          albumArt = pathToFileURL(filePath).href;
        }
      } catch {
        albumArt = '';
      }
      return {
        ...track,
        uri: `spotify:track:demo${index + 1}`,
        albumArt,
      };
    });

    this.playlists = [
      { uri: 'spotify:playlist:demo1', name: 'Afterglow', trackIndexes: [0, 3] },
      { uri: 'spotify:playlist:demo2', name: 'Night Signals', trackIndexes: [1, 4] },
      { uri: 'spotify:playlist:demo3', name: 'City Lights', trackIndexes: [2, 5] },
    ];
  }

  _playlistSummary(playlist) {
    const first = this.tracks[playlist.trackIndexes[0]];
    return {
      uri: playlist.uri,
      name: playlist.name,
      image: first?.albumArt || '',
      trackCount: playlist.trackIndexes.length,
    };
  }

  _playlistDetail(playlist) {
    return {
      ...this._playlistSummary(playlist),
      description: 'Demo playlist',
      tracks: playlist.trackIndexes
        .map((index) => this._queueTrack(index))
        .filter(Boolean),
      updatedAt: Date.now(),
    };
  }

  _track() {
    return this.tracks[this.index % this.tracks.length];
  }

  _queueTrack(index) {
    const track = this.tracks[index];
    if (!track) return null;
    return {
      uri: track.uri,
      title: track.title,
      artist: track.artist,
      album: track.album,
      albumArt: track.albumArt,
      durationMs: track.durationMs,
    };
  }

  _playback() {
    if (this.empty || this.offline) return null;
    const track = this._track();
    return {
      trackId: track.uri,
      uri: track.uri,
      type: 'track',
      title: track.title,
      artist: track.artist,
      album: track.album,
      albumArt: track.albumArt,
      accent: track.accent,
      isPlaying: this.isPlaying,
      durationMs: track.durationMs,
      positionMs: this.progressMs,
      device: {
        id: 'demo-device',
        name: 'This PC',
        type: 'Computer',
        volumePercent: this.volume,
        isRestricted: false,
      },
    };
  }

  _queue() {
    return {
      upcoming: this.queue.map((index) => this._queueTrack(index)).filter(Boolean),
      revision: this.queue.join(','),
      updatedAt: this.updatedAt,
    };
  }

  snapshot() {
    if (this.offline) {
      return {
        status: 'offline',
        connection: 'offline',
        playback: null,
        queueCount: 0,
        volume: null,
        cli: { available: false, path: '', version: '' },
        notice: {
          kind: 'offline',
          message: 'Spotify is closed. Open the desktop app to connect.',
        },
        updatedAt: this.updatedAt,
      };
    }

    return {
      status: 'online',
      connection: 'online',
      playback: this._playback(),
      queueCount: this.queue.length,
      volume: this.volume,
      cli: { available: true, path: 'demo', version: 'demo' },
      notice: null,
      updatedAt: this.updatedAt,
    };
  }

  _emit() {
    this.updatedAt = Date.now();
    this.emit('state', this.snapshot());
  }

  _schedule() {
    if (this.closed) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      if (this.closed) return;

      if (this.isPlaying && !this.empty && !this.offline) {
        this.progressMs += 1000;
        if (this.progressMs >= this._track().durationMs) {
          this._advance();
        }
        this._emit();
      }

      this._schedule();
    }, 1000);
    this.timer.unref?.();
  }

  _advance() {
    if (this.queue.length) {
      this.index = this.queue.shift();
    } else {
      this.index = (this.index + 1) % this.tracks.length;
    }
    this.progressMs = 0;
  }

  async start() {
    this._emit();
    this._schedule();
  }

  stop() {
    this.closed = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  setWindowVisible(visible) {
    this.visible = Boolean(visible);
    if (this.visible) this._emit();
  }

  async refreshNow() {
    this._emit();
  }

  async togglePlayback() {
    if (this.offline || this.empty) {
      throw new AppError(
        'SPOTIFY_NOT_RUNNING',
        'Spotify is not running. Open the desktop app to connect.',
      );
    }
    this.isPlaying = !this.isPlaying;
    this._emit();
  }

  async skipToNext() {
    if (this.offline || this.empty) return;
    this._advance();
    this._emit();
  }

  async skipToPrevious() {
    if (this.offline || this.empty) return;
    this.index = (this.index - 1 + this.tracks.length) % this.tracks.length;
    this.progressMs = 0;
    this._emit();
  }

  async setVolume(value) {
    const volume = clamp(Math.round(Number(value)), 0, 100);
    if (!Number.isFinite(volume)) {
      throw new AppError('INVALID_VOLUME', 'Volume must be a number between 0 and 100.');
    }
    this.volume = volume;
    this._emit();
  }

  async getQueue() {
    return this._queue();
  }

  async removeFromQueue(position) {
    const index = Number(position);
    if (!Number.isInteger(index) || index < 0 || index >= this.queue.length) {
      throw new AppError('INVALID_QUEUE_POSITION', 'That queue item is no longer available.');
    }
    this.queue.splice(index, 1);
    this._emit();
    return this._queue();
  }

  async addToQueue(uri) {
    const index = this.tracks.findIndex((track) => track.uri === uri);
    if (index < 0) {
      throw new AppError('INVALID_TRACK', 'That item cannot be added to the queue.');
    }
    this.queue.push(index);
    this._emit();
    return true;
  }

  async playUri(uri) {
    const playlist = this.playlists.find((item) => item.uri === uri);
    if (playlist) {
      const [first, ...rest] = playlist.trackIndexes;
      this.index = first;
      this.queue = rest;
      this.progressMs = 0;
      this.isPlaying = true;
      this._emit();
      return true;
    }

    const contextPrefix = uri.startsWith('spotify:album:demo-')
      ? 'album'
      : uri.startsWith('spotify:artist:demo-')
        ? 'artist'
        : '';
    if (contextPrefix) {
      const name = uri.slice(`spotify:${contextPrefix}:demo-`.length);
      const indexes = this.tracks
        .map((track, index) => (track[contextPrefix] === name ? index : -1))
        .filter((index) => index >= 0);
      if (indexes.length) {
        const [first, ...rest] = indexes;
        this.index = first;
        this.queue = rest;
        this.progressMs = 0;
        this.isPlaying = true;
        this._emit();
        return true;
      }
    }

    const index = this.tracks.findIndex((track) => track.uri === uri);
    if (index < 0) {
      throw new AppError('INVALID_TRACK', 'That item cannot be played.');
    }
    this.index = index;
    this.progressMs = 0;
    this.isPlaying = true;
    this.queue = this.queue.filter((item) => item !== index);
    this._emit();
    return true;
  }

  async search(query, type = 'track') {
    const term = String(query || '').trim().toLowerCase();
    if (!term) return [];
    if (this.offline) {
      throw new AppError(
        'SPOTIFY_NOT_RUNNING',
        'Spotify is not running. Open the desktop app to connect.',
      );
    }

    if (type === 'playlist') {
      return this.playlists
        .map((playlist) => this._playlistSummary(playlist))
        .filter((playlist) => playlist.name.toLowerCase().includes(term))
        .map((playlist) => ({
          kind: 'playlist',
          uri: playlist.uri,
          title: playlist.name,
          artist: '',
          album: '',
          albumArt: playlist.image,
          durationMs: 0,
        }));
    }

    if (type === 'album' || type === 'artist') {
      const seen = new Set();
      return this.tracks
        .filter((track) => {
          const haystack = type === 'album' ? track.album : track.artist;
          return haystack.toLowerCase().includes(term);
        })
        .filter((track) => {
          const key = type === 'album' ? track.album : track.artist;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map((track) => ({
          kind: type,
          uri: type === 'album' ? `spotify:album:demo-${track.album}` : `spotify:artist:demo-${track.artist}`,
          title: type === 'album' ? track.album : track.artist,
          artist: type === 'album' ? track.artist : '',
          album: '',
          albumArt: track.albumArt,
          durationMs: 0,
        }));
    }

    return this.tracks
      .filter((track) => `${track.title} ${track.artist} ${track.album}`.toLowerCase().includes(term))
      .map((track) => ({
        kind: 'track',
        uri: track.uri,
        title: track.title,
        artist: track.artist,
        album: track.album,
        albumArt: track.albumArt,
        durationMs: track.durationMs,
      }));
  }

  async seek(positionMs) {
    if (this.offline || this.empty) {
      throw new AppError('SPOTIFY_NOT_RUNNING', 'Spotify is not running.');
    }
    const duration = this._track().durationMs;
    this.progressMs = clamp(Math.round(Number(positionMs)) || 0, 0, duration);
    this._emit();
    return true;
  }

  async getPlaylists() {
    return {
      playlists: this.playlists.map((playlist) => this._playlistSummary(playlist)),
      updatedAt: Date.now(),
    };
  }

  async getPlaylist(uri) {
    const playlist = this.playlists.find((item) => item.uri === uri);
    if (!playlist) {
      throw new AppError('INVALID_PLAYLIST', 'Choose a valid playlist.');
    }
    return this._playlistDetail(playlist);
  }

  async openSpotify() {
    this.offline = false;
    this.empty = false;
    this._emit();
  }
}

module.exports = { DemoService, DEMO_TRACKS };
