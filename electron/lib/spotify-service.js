'use strict';

const { EventEmitter } = require('node:events');
const { shell, nativeImage } = require('electron');
const {
  FALLBACK_ACCENT,
  POLL_INTERVAL_MS,
  HIDDEN_POLL_INTERVAL_MS,
} = require('./constants');
const { AppError } = require('./errors');
const { extractAccentFromBitmap } = require('./color');
const {
  findSpotifyCli,
  runSpotifyCli,
  extractJson,
  parseNowPlayingJson,
  parseLookupJson,
  parseQueueJson,
  parseSearchJson,
  parsePlaylistListJson,
  parsePlaylistJson,
  parseDeviceListJson,
  parseStatusJson,
  parseVersionOutput,
} = require('./spotify-cli');

const ACCENT_TIMEOUT_MS = 6000;
const TRACK_CACHE_LIMIT = 240;
const QUEUE_REFRESH_MS = 12000;
const PLAYLIST_REFRESH_MS = 60000;
const POSITION_SYNC_MS = 20000;
const SEARCH_TYPES = new Set(['track', 'album', 'artist', 'playlist']);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function isTrackUri(value) {
  return /^spotify:(?:track|episode):[A-Za-z0-9]+$/.test(String(value || ''));
}

function isPlayableUri(value) {
  return /^spotify:(?:track|episode|album|artist|playlist):[A-Za-z0-9]+$/.test(
    String(value || ''),
  );
}

function isPlaylistUri(value) {
  return /^spotify:playlist:[A-Za-z0-9]+$/.test(String(value || ''));
}

function sameTitle(left, right) {
  const normalize = (value) => String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const a = normalize(left);
  const b = normalize(right);
  return !a || !b || a === b || a.includes(b) || b.includes(a);
}

function mergeTrack(primary, fallback) {
  return {
    uri: primary.uri,
    title: primary.title || fallback?.title || 'Unknown track',
    artist: primary.artist || fallback?.artist || '',
    album: primary.album || fallback?.album || '',
    albumArt: primary.albumArt || fallback?.albumArt || '',
    durationMs: primary.durationMs || fallback?.durationMs || 0,
  };
}

/**
 * Talks to the Spotify desktop app through the local spotify_cli helper that
 * ships beside Spotify.exe. There is no OAuth, no developer app, no token
 * storage, and no network API dependency for playback, queue, or search.
 */
class SpotifyService extends EventEmitter {
  constructor({
    logger = console,
    pollIntervalMs = POLL_INTERVAL_MS,
    hiddenPollIntervalMs = HIDDEN_POLL_INTERVAL_MS,
    env = process.env,
    runCli = runSpotifyCli,
    findCli = findSpotifyCli,
    readMediaPosition = null,
    openExternal = (url) => shell.openExternal(url),
  } = {}) {
    super();

    this.logger = logger;
    this.pollIntervalMs = clamp(Number(pollIntervalMs) || POLL_INTERVAL_MS, 1000, 5000);
    this.hiddenPollIntervalMs = clamp(
      Number(hiddenPollIntervalMs) || HIDDEN_POLL_INTERVAL_MS,
      3000,
      30000,
    );
    this.env = env;
    this.runCli = runCli;
    this.findCli = findCli;
    this.readMediaPosition = readMediaPosition;
    this.openExternal = openExternal;

    this._status = 'starting';
    this._notice = null;
    this._playback = null;
    this._device = null;
    this._volume = null;
    this._queue = null;
    this._queueCount = 0;
    this._queueInitialized = false;
    this._queueNextAttempt = 0;
    this._updatedAt = null;
    this._cliPath = null;
    this._cliVersion = '';
    this._visible = true;
    this._closed = false;
    this._pollTimer = null;
    this._pollPromise = null;
    this._queuePromise = null;
    this._pollCount = 0;
    this._trackCache = new Map();
    this._accentCache = new Map();
    this._accentPending = new Map();
    this._position = null;
    this._positionSyncAt = 0;
    this._positionSyncTrack = '';
    this._playlists = null;
    this._playlistCache = new Map();
  }

  snapshot() {
    return {
      status: this._status,
      connection:
        this._status === 'online'
          ? 'online'
          : this._status === 'starting'
            ? 'connecting'
            : 'offline',
      playback: this._playback
        ? { ...this._playback, positionMs: this._positionFor(this._playback) }
        : null,
      queueCount: this._queueCount,
      volume: this._volume,
      cli: {
        available: Boolean(this._cliPath),
        path: this._cliPath || '',
        version: this._cliVersion,
      },
      notice: this._notice,
      updatedAt: this._updatedAt,
    };
  }

  _emit() {
    this.emit('state', this.snapshot());
  }

  _positionFor(playback) {
    if (!playback) return 0;
    if (!this._position || this._position.trackId !== playback.uri) return 0;

    let position = this._position.positionMs;
    if (playback.isPlaying) {
      position += Date.now() - this._position.at;
    }

    const duration = playback.durationMs || this._position.durationMs || 0;
    return duration > 0
      ? clamp(Math.round(position), 0, duration)
      : Math.max(0, Math.round(position));
  }

  _freezePosition(playback = this._playback) {
    if (!playback) return;
    const position = this._positionFor(playback);
    this._position = {
      trackId: playback.uri,
      positionMs: position,
      at: Date.now(),
      durationMs: playback.durationMs || this._position?.durationMs || 0,
    };
  }

  _runJson(args, timeoutMs) {
    return this.runCli(this._cliPath, args, { timeoutMs }).then(extractJson);
  }

  async start() {
    this._cliPath = this.findCli({ env: this.env });

    if (!this._cliPath) {
      this._setCliMissing();
      return;
    }

    this._status = 'starting';
    this._emit();

    try {
      const versionOutput = await this.runCli(this._cliPath, ['version'], { timeoutMs: 5000 });
      this._cliVersion = parseVersionOutput(versionOutput);
    } catch (error) {
      this.logger.warn(`[spotify] Could not read spotify_cli version: ${error.message}`);
    }

    await this._checkStatus();
  }

  stop() {
    this._closed = true;
    if (this._pollTimer) {
      clearTimeout(this._pollTimer);
      this._pollTimer = null;
    }
    this._pollPromise = null;
    this._queuePromise = null;
  }

  setWindowVisible(visible) {
    const next = Boolean(visible);
    if (this._visible === next) return;
    this._visible = next;

    if (next) {
      if (this._status === 'online') this._poll();
      else if (this._status !== 'cli-missing') this._checkStatus();
    } else {
      this._scheduleNext();
    }
  }

  async refreshNow() {
    if (this._status === 'cli-missing') {
      this._cliPath = this.findCli({ env: this.env });
      if (!this._cliPath) {
        this._setCliMissing();
        return;
      }
      this._status = 'starting';
    }

    if (this._status === 'online') {
      await this._poll();
    } else {
      await this._checkStatus();
    }
  }

  async _checkStatus() {
    if (this._closed || !this._cliPath) return;

    try {
      const status = parseStatusJson(
        await this._runJson(['status', '--format', 'json'], 8000),
      );

      if (!status.running) {
        this._setOffline('Spotify is closed. Open the desktop app to connect.');
        this._scheduleNext();
        return;
      }

      if (!status.loggedIn) {
        this._setOffline('Sign in to the Spotify desktop app, then try again.');
        this._scheduleNext();
        return;
      }

      this._status = 'online';
      this._notice = null;
      await this._poll();
    } catch (error) {
      if (error.code === 'SPOTIFY_CLI_MISSING') {
        this._setCliMissing();
        return;
      }

      if (error.code === 'SPOTIFY_NOT_RUNNING' || error.code === 'SPOTIFY_NOT_LOGGED_IN') {
        this._setOffline(error.message);
        this._scheduleNext();
        return;
      }

      if (this._status === 'starting') {
        this._setOffline('Spotify is not responding. Open the desktop app to connect.');
        this._scheduleNext();
        return;
      }

      // Never promote an offline widget to online just because we still have
      // retained playback. Otherwise a run of CLI timeouts can look connected.
      if (this._status !== 'online') {
        this._updatedAt = Date.now();
        this._emit();
        this._scheduleNext();
        return;
      }

      this._notice = { kind: 'error', message: error.message };
      this._updatedAt = Date.now();
      this._emit();
      this._scheduleNext();
    }
  }

  _setCliMissing() {
    this._status = 'cli-missing';
    this._notice = {
      kind: 'error',
      message:
        'Spotify desktop was not found. Install or update Spotify, then reopen the widget.',
    };
    this._playback = null;
    this._device = null;
    this._volume = null;
    this._queue = null;
    this._queueCount = 0;
    this._position = null;
    this._playlists = null;
    this._playlistCache.clear();
    this._updatedAt = Date.now();
    this._emit();
  }

  _setOffline(message) {
    this._status = 'offline';
    this._notice = { kind: 'offline', message };

    // Keep the last known playback, artwork, device, volume, queue, and
    // playlists so the widget stays useful while Spotify is closed. Every
    // value is refreshed automatically as soon as Spotify reconnects.
    if (this._playback) {
      this._freezePosition(this._playback);
      this._playback = { ...this._playback, isPlaying: false };
    }
    this._queueInitialized = false;
    this._updatedAt = Date.now();
    this._emit();
  }

  _scheduleNext(delayMs) {
    if (this._closed || this._status === 'cli-missing') return;
    if (this._pollTimer) clearTimeout(this._pollTimer);

    const fallback = this._status === 'online' ? this._currentInterval() : 5000;
    const delay = Number.isFinite(delayMs) ? Math.max(0, delayMs) : fallback;

    this._pollTimer = setTimeout(() => {
      this._pollTimer = null;
      if (this._status === 'online') this._poll();
      else if (this._status !== 'cli-missing') this._checkStatus();
    }, delay);
    this._pollTimer.unref?.();
  }

  _currentInterval() {
    return this._visible ? this.pollIntervalMs : this.hiddenPollIntervalMs;
  }

  async _poll() {
    if (this._closed || this._status === 'cli-missing' || !this._cliPath) return;
    if (this._pollPromise) return this._pollPromise;

    this._pollPromise = (async () => {
      try {
        await this._pollOnce();
      } finally {
        this._pollPromise = null;
        this._scheduleNext();
      }
    })();

    return this._pollPromise;
  }

  async _pollOnce() {
    this._pollCount += 1;

    const shouldReadDevice = this._volume === null || this._pollCount % 3 === 1;
    const tasks = [
      this._runJson(['now-playing', '--format', 'json'], 8000).then(parseNowPlayingJson),
    ];
    if (shouldReadDevice) {
      tasks.push(this._runJson(['devices', 'list', '--format', 'json'], 8000).then(parseDeviceListJson));
    }

    const [nowResult, deviceResult] = await Promise.allSettled(tasks);

    if (nowResult.status === 'rejected') {
      const error = nowResult.reason;
      if (error.code === 'SPOTIFY_CLI_MISSING') {
        this._setCliMissing();
        return;
      }
      if (error.code === 'SPOTIFY_NOT_RUNNING' || error.code === 'SPOTIFY_NOT_LOGGED_IN') {
        this._setOffline(error.message);
        return;
      }

      // A timeout or transient CLI failure must not flip an offline widget
      // back to "online". Keep the last known state and retry on the next poll.
      if (this._status !== 'online') {
        this._updatedAt = Date.now();
        this._emit();
        return;
      }

      this._notice = { kind: 'error', message: error.message };
      this._updatedAt = Date.now();
      this._emit();
      return;
    }

    if (deviceResult?.status === 'fulfilled') {
      const device = deviceResult.value;
      this._device = device;
      this._volume = device?.volumePercent ?? null;
    }

    const current = nowResult.value.current;
    if (!current) {
      this._playback = null;
      this._position = null;
      this._positionSyncTrack = '';
      this._updatedAt = Date.now();
      this._status = 'online';
      this._notice = null;
      this._emit();
      if (!this._queueInitialized) {
        this._queueInitialized = true;
        this.getQueue({ force: true, enrich: false }).catch(() => {});
      } else {
        this._maybeRefreshQueue();
      }
      return;
    }

    let metadata = this._trackCache.get(current.uri) || null;
    if (!metadata) {
      try {
        metadata = await this._lookupTrack(current.uri);
      } catch (error) {
        this.logger.warn(`[spotify] Could not look up track metadata: ${error.message}`);
      }
    }

    const track = mergeTrack(metadata || current, current);
    const albumArt = track.albumArt;
    const accent = albumArt ? this._accentCache.get(albumArt) || FALLBACK_ACCENT : FALLBACK_ACCENT;

    if (!this._position || this._position.trackId !== current.uri) {
      // A new track starts at zero; the SMTC sync below corrects it if the
      // track was already playing before the widget opened.
      this._position = {
        trackId: current.uri,
        positionMs: 0,
        at: Date.now(),
        durationMs: track.durationMs || 0,
      };
      this._positionSyncTrack = '';
    } else if (this._playback && this._playback.isPlaying !== current.isPlaying) {
      this._freezePosition(this._playback);
    }

    this._playback = {
      trackId: current.uri,
      uri: current.uri,
      type: current.uri.startsWith('spotify:episode:') ? 'episode' : 'track',
      title: track.title,
      artist: track.artist,
      album: track.album,
      albumArt,
      accent,
      isPlaying: current.isPlaying,
      durationMs: track.durationMs,
      context: current.context,
      device: this._device,
    };

    this._status = 'online';
    this._notice = null;
    this._updatedAt = Date.now();
    this._emit();

    if (albumArt) {
      this._resolveAccent(albumArt).catch(() => {});
    }

    this._syncPosition(current, track).catch(() => {});

    if (!this._queueInitialized) {
      this._queueInitialized = true;
      this._queueNextAttempt = Date.now() + QUEUE_REFRESH_MS;
      this.getQueue({ force: true, enrich: false }).catch(() => {
        this._queueInitialized = false;
      });
    } else {
      this._maybeRefreshQueue();
    }
  }

  _maybeRefreshQueue() {
    if (!this._visible || this._queuePromise) return;

    const now = Date.now();
    if (this._queue && now - this._queue.updatedAt < QUEUE_REFRESH_MS) return;
    if (now < this._queueNextAttempt) return;

    this._queueNextAttempt = now + QUEUE_REFRESH_MS;
    this.getQueue({ force: true, enrich: false }).catch(() => {});
  }

  async _syncPosition(current, track) {
    if (!this.readMediaPosition) return;

    const now = Date.now();
    if (
      this._positionSyncTrack === current.uri &&
      now - this._positionSyncAt < POSITION_SYNC_MS
    ) {
      return;
    }

    this._positionSyncTrack = current.uri;
    this._positionSyncAt = now;

    const info = await this.readMediaPosition();
    if (!info || this._playback?.uri !== current.uri) return;
    if (!sameTitle(info.title, track.title)) return;

    const duration = info.durationMs || track.durationMs || 0;
    this._position = {
      trackId: current.uri,
      positionMs: info.positionMs,
      at: Date.now(),
      durationMs: duration,
    };
    if (duration > 0 && this._playback.durationMs !== duration) {
      this._playback = { ...this._playback, durationMs: duration };
    }
    this._updatedAt = Date.now();
    this._emit();
  }

  async _lookupTrack(uri) {
    if (!isTrackUri(uri)) return null;
    if (this._trackCache.has(uri)) return this._trackCache.get(uri);

    const entities = parseLookupJson(
      await this.runCli(
        this._cliPath,
        ['lookup', uri, '--fields', 'duration', '--format', 'json'],
        { timeoutMs: 8000 },
      ),
    );
    const metadata = entities[0] || null;
    if (metadata) {
      this._trackCache.set(uri, metadata);
      if (this._trackCache.size > TRACK_CACHE_LIMIT) {
        this._trackCache.delete(this._trackCache.keys().next().value);
      }
    }
    return metadata;
  }

  async _resolveAccent(url) {
    if (!url) return;
    if (this._accentCache.has(url)) return this._accentCache.get(url);
    if (this._accentPending.has(url)) return this._accentPending.get(url);

    const pending = (async () => {
      let accent = FALLBACK_ACCENT;
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(ACCENT_TIMEOUT_MS),
        });
        if (response.ok) {
          const buffer = Buffer.from(await response.arrayBuffer());
          let image = nativeImage.createFromBuffer(buffer);
          if (!image.isEmpty()) {
            image = image.resize({ width: 64, height: 64, quality: 'good' });
            const size = image.getSize();
            accent = extractAccentFromBitmap(image.toBitmap(), size.width, size.height);
          }
        }
      } catch {
        accent = FALLBACK_ACCENT;
      }

      this._accentCache.set(url, accent);
      if (this._accentCache.size > 120) {
        this._accentCache.delete(this._accentCache.keys().next().value);
      }
      this._accentPending.delete(url);

      if (this._playback?.albumArt === url && this._playback.accent !== accent) {
        this._playback = { ...this._playback, accent };
        this._updatedAt = Date.now();
        this._emit();
      }

      return accent;
    })();

    this._accentPending.set(url, pending);
    return pending;
  }

  async _enrichQueue(upcoming) {
    // Resolve every queued track, not just the first screenful. `_lookupUris`
    // chunks the request, so long queues still get their artwork.
    const missing = [
      ...new Set(
        upcoming
          .map((track) => track.uri)
          .filter((uri) => isTrackUri(uri) && !this._trackCache.has(uri)),
      ),
    ];

    const resolved = new Map();
    if (missing.length > 0) {
      try {
        const entities = await this._lookupUris(missing);
        for (const entity of entities) {
          resolved.set(entity.uri, entity);
          this._trackCache.set(entity.uri, entity);
        }
      } catch (error) {
        this.logger.warn(`[spotify] Could not load queue artwork: ${error.message}`);
      }
    }

    return upcoming.map((track) => {
      // Use the freshly resolved entity even if the shared cache evicted it.
      const metadata = resolved.get(track.uri) || this._trackCache.get(track.uri);
      return metadata ? mergeTrack(metadata, track) : track;
    });
  }

  async getQueue({ force = false, enrich = true } = {}) {
    if (this._status !== 'online') {
      throw new AppError('SPOTIFY_NOT_RUNNING', 'Spotify is not running. Open the desktop app to connect.');
    }

    if (
      !force &&
      this._queue &&
      Date.now() - this._queue.updatedAt < 4000 &&
      (!enrich || this._queue.enriched)
    ) {
      return this._queue;
    }

    if (this._queuePromise) {
      // A background refresh may be running without artwork. Wait for it, then
      // run an enriched pass if the caller asked for one.
      await this._queuePromise;
      if (!enrich || this._queue?.enriched) return this._queue;
      return this.getQueue({ force: true, enrich: true });
    }

    this._queuePromise = (async () => {
      try {
        const parsed = parseQueueJson(
          await this.runCli(this._cliPath, ['queue', '--format', 'json'], { timeoutMs: 10000 }),
        );
        const upcoming = enrich
          ? await this._enrichQueue(parsed.upcoming)
          : parsed.upcoming.map((track) => {
              // Background refreshes skip extra lookups, but keep any artwork
              // that was already resolved for these tracks.
              const metadata = this._trackCache.get(track.uri);
              return metadata ? mergeTrack(metadata, track) : track;
            });

        this._queue = {
          upcoming,
          revision: parsed.revision,
          enriched: Boolean(enrich),
          updatedAt: Date.now(),
        };
        this._queueCount = upcoming.length;
        this._queueInitialized = true;
        this._updatedAt = Date.now();
        this._emit();
        return this._queue;
      } finally {
        this._queuePromise = null;
      }
    })();

    return this._queuePromise;
  }

  async removeFromQueue(position) {
    const index = Number(position);
    if (!Number.isInteger(index) || index < 0) {
      throw new AppError('INVALID_QUEUE_POSITION', 'Choose a valid queue item.');
    }

    const queue = await this.getQueue({ force: true, enrich: false });
    if (index >= queue.upcoming.length) {
      throw new AppError('INVALID_QUEUE_POSITION', 'That queue item is no longer available.');
    }

    await this.runCli(this._cliPath, ['queue', 'remove', String(index)], { timeoutMs: 8000 });

    const upcoming = queue.upcoming.filter((_, itemIndex) => itemIndex !== index);
    this._queue = { ...queue, upcoming, updatedAt: Date.now() };
    this._queueCount = upcoming.length;
    this._updatedAt = Date.now();
    this._emit();
    return this._queue;
  }

  async addToQueue(uri) {
    if (!isTrackUri(uri)) {
      throw new AppError('INVALID_TRACK', 'That item cannot be added to the queue.');
    }

    await this.runCli(this._cliPath, ['queue', 'add', uri], { timeoutMs: 8000 });
    if (this._queue) {
      this._queue = null;
      this._queueInitialized = false;
    }
    this._queueCount += 1;
    this._updatedAt = Date.now();
    this._emit();
    this._scheduleNext(600);
    return true;
  }

  async playUri(uri) {
    if (!isPlayableUri(uri)) {
      throw new AppError('INVALID_TRACK', 'That item cannot be played.');
    }

    await this.runCli(this._cliPath, ['play', uri], { timeoutMs: 10000 });
    this._scheduleNext(300);
    return true;
  }

  async search(query, type = 'track') {
    const term = String(query || '').trim().slice(0, 120);
    if (!term) return [];
    if (this._status !== 'online') {
      throw new AppError('SPOTIFY_NOT_RUNNING', 'Spotify is not running. Open the desktop app to connect.');
    }

    const kind = SEARCH_TYPES.has(type) ? type : 'track';
    return parseSearchJson(
      await this.runCli(
        this._cliPath,
        ['search', term, '--type', kind, '--limit', '12', '--format', 'json'],
        { timeoutMs: 10000 },
      ),
      kind,
    );
  }

  async seek(positionMs) {
    if (!this._playback) {
      throw new AppError('NO_TRACK', 'Start a track in Spotify first.');
    }

    const value = Math.round(Number(positionMs));
    if (!Number.isFinite(value) || value < 0) {
      throw new AppError('INVALID_POSITION', 'Choose a valid position in the track.');
    }

    const duration = this._playback.durationMs || 0;
    const target = duration > 0 ? clamp(value, 0, duration) : value;

    await this.runCli(this._cliPath, ['seek', String(target)], { timeoutMs: 8000 });

    this._position = {
      trackId: this._playback.uri,
      positionMs: target,
      at: Date.now(),
      durationMs: duration,
    };
    this._updatedAt = Date.now();
    this._emit();
    return true;
  }

  async getPlaylists({ force = false } = {}) {
    if (this._status !== 'online') {
      throw new AppError('SPOTIFY_NOT_RUNNING', 'Spotify is not running. Open the desktop app to connect.');
    }

    if (
      !force &&
      this._playlists &&
      Date.now() - this._playlists.updatedAt < PLAYLIST_REFRESH_MS
    ) {
      return this._playlists;
    }

    const parsed = parsePlaylistListJson(
      await this.runCli(
        this._cliPath,
        ['library', 'list', '--type', 'playlist', '--limit', '60', '--format', 'json'],
        { timeoutMs: 12000 },
      ),
    );

    let images = new Map();
    try {
      const entities = await this._lookupUris(parsed.map((playlist) => playlist.uri));
      images = new Map(entities.map((entity) => [entity.uri, entity.albumArt]));
    } catch (error) {
      this.logger.warn(`[spotify] Could not load playlist artwork: ${error.message}`);
    }

    const playlists = parsed.map((playlist) => ({
      ...playlist,
      image: images.get(playlist.uri) || '',
      trackCount: 0,
    }));

    this._playlists = { playlists, updatedAt: Date.now() };
    return this._playlists;
  }

  async getPlaylist(uri, { force = false } = {}) {
    if (!isPlaylistUri(uri)) {
      throw new AppError('INVALID_PLAYLIST', 'Choose a valid playlist.');
    }
    if (this._status !== 'online') {
      throw new AppError('SPOTIFY_NOT_RUNNING', 'Spotify is not running. Open the desktop app to connect.');
    }

    const cached = this._playlistCache.get(uri);
    if (!force && cached && Date.now() - cached.updatedAt < PLAYLIST_REFRESH_MS) {
      return cached;
    }

    const parsed = parsePlaylistJson(
      await this.runCli(
        this._cliPath,
        ['playlist', 'get', uri, '--limit', '200', '--format', 'json'],
        { timeoutMs: 15000 },
      ),
    );

    const missing = parsed.tracks
      .map((track) => track.uri)
      .filter((trackUri) => isTrackUri(trackUri) && !this._trackCache.has(trackUri));

    let image = '';
    try {
      const entities = await this._lookupUris([uri, ...missing]);
      for (const entity of entities) {
        if (entity.uri === uri) image = entity.albumArt;
        else this._trackCache.set(entity.uri, entity);
      }
    } catch (error) {
      this.logger.warn(`[spotify] Could not load playlist details: ${error.message}`);
    }

    const tracks = parsed.tracks.map((track) => {
      const metadata = this._trackCache.get(track.uri);
      return metadata ? mergeTrack(metadata, track) : track;
    });

    const detail = { ...parsed, image, tracks, updatedAt: Date.now() };
    this._playlistCache.set(uri, detail);
    return detail;
  }

  async _lookupUris(uris) {
    const unique = [...new Set(uris.filter(Boolean))];
    const entities = [];

    for (let index = 0; index < unique.length; index += 40) {
      const chunk = unique.slice(index, index + 40);
      try {
        entities.push(
          ...parseLookupJson(
            await this.runCli(
              this._cliPath,
              ['lookup', ...chunk, '--format', 'json'],
              { timeoutMs: 15000 },
            ),
          ),
        );
      } catch (error) {
        this.logger.warn(`[spotify] Could not resolve ${chunk.length} items: ${error.message}`);
      }
    }

    return entities;
  }

  async togglePlayback() {
    if (!this._playback) {
      throw new AppError('NO_TRACK', 'Start a track in Spotify first.');
    }

    const target = !this._playback.isPlaying;
    this._freezePosition();
    await this.runCli(this._cliPath, [target ? 'resume' : 'pause'], { timeoutMs: 8000 });

    if (this._playback) {
      this._playback = { ...this._playback, isPlaying: target };
      if (this._position) this._position = { ...this._position, at: Date.now() };
      this._updatedAt = Date.now();
      this._emit();
    }
    this._scheduleNext(500);
  }

  async skipToNext() {
    await this.runCli(this._cliPath, ['next'], { timeoutMs: 8000 });
    this._scheduleNext(350);
    if (this._queue) this.getQueue({ force: true, enrich: false }).catch(() => {});
  }

  async skipToPrevious() {
    await this.runCli(this._cliPath, ['previous'], { timeoutMs: 8000 });
    this._scheduleNext(350);
    if (this._queue) this.getQueue({ force: true, enrich: false }).catch(() => {});
  }

  async setVolume(value) {
    const volume = clamp(Math.round(Number(value)), 0, 100);
    if (!Number.isFinite(volume)) {
      throw new AppError('INVALID_VOLUME', 'Volume must be a number between 0 and 100.');
    }

    const previous = this._volume;
    this._volume = volume;
    if (this._device) {
      this._device = { ...this._device, volumePercent: volume };
    }
    if (this._playback?.device) {
      this._playback = {
        ...this._playback,
        device: { ...this._playback.device, volumePercent: volume },
      };
    }
    this._updatedAt = Date.now();
    this._emit();

    try {
      // The top-level `volume` command works with the active device. The
      // `devices volume` subcommand in spotify_cli 1.3.9 treats the same float
      // as a percentage and drives the device to 0, so avoid it.
      await this.runCli(
        this._cliPath,
        ['volume', (volume / 100).toFixed(2)],
        { timeoutMs: 8000 },
      );
    } catch (error) {
      this._volume = previous;
      if (this._device) {
        this._device = { ...this._device, volumePercent: previous };
      }
      if (this._playback?.device) {
        this._playback = {
          ...this._playback,
          device: { ...this._playback.device, volumePercent: previous },
        };
      }
      this._updatedAt = Date.now();
      this._emit();
      throw error;
    }

    this._scheduleNext(700);
  }

  async openSpotify() {
    let launched = false;

    if (this._cliPath) {
      try {
        await this.runCli(this._cliPath, ['open'], { timeoutMs: 8000 });
        launched = true;
      } catch (error) {
        this.logger.warn(`[spotify] CLI could not open Spotify: ${error.message}`);
      }
    }

    if (!launched) {
      // The protocol handler still launches an installed Spotify client even
      // when the local CLI cannot reach a closed client.
      await this.openExternal('spotify:');
    }

    this._scheduleNext(1200);
  }
}

module.exports = {
  SpotifyService,
  isTrackUri,
  isPlayableUri,
  isPlaylistUri,
};
