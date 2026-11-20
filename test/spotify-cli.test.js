'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
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
} = require('../electron/lib/spotify-cli');

test('findSpotifyCli prefers an explicit path and falls back to Spotify app data', () => {
  const env = {
    APPDATA: 'C:\\Users\\me\\AppData\\Roaming',
    LOCALAPPDATA: 'C:\\Users\\me\\AppData\\Local',
    ProgramFiles: 'C:\\Program Files',
    SPOTIFY_CLI_PATH: 'D:\\Tools\\spotify_cli.exe',
  };

  const checked = [];
  const found = findSpotifyCli({
    env,
    isFile: (candidate) => {
      checked.push(candidate);
      return candidate === path.join(env.APPDATA, 'Spotify', 'spotify_cli.exe');
    },
  });

  assert.equal(found, path.join(env.APPDATA, 'Spotify', 'spotify_cli.exe'));
  assert.equal(checked[0], env.SPOTIFY_CLI_PATH);
});

test('findSpotifyCli returns null when no candidate exists', () => {
  assert.equal(
    findSpotifyCli({
      env: { APPDATA: 'C:\\Users\\me\\AppData\\Roaming' },
      isFile: () => false,
    }),
    null,
  );
});

test('runSpotifyCli maps a missing executable to a friendly error', async () => {
  await assert.rejects(
    runSpotifyCli('Z:\\missing\\spotify_cli.exe', ['status'], { timeoutMs: 2000 }),
    (error) => {
      assert.equal(error.code, 'SPOTIFY_CLI_MISSING');
      assert.match(error.message, /Install or update Spotify/);
      return true;
    },
  );
});

test('extractJson tolerates a leading message around a JSON object', () => {
  assert.deepEqual(extractJson('warning: something\n{"ok":true}\n'), { ok: true });
});

test('extractJson rejects empty and malformed responses', () => {
  assert.throws(() => extractJson(''), { code: 'SPOTIFY_BAD_RESPONSE' });
  assert.throws(() => extractJson('not json'), { code: 'SPOTIFY_BAD_RESPONSE' });
});

test('extractJson passes through already-parsed values', () => {
  const parsed = { running: true, logged_in: true };
  assert.equal(extractJson(parsed), parsed);
  assert.deepEqual(extractJson([{ uri: 'spotify:track:abc' }]), [
    { uri: 'spotify:track:abc' },
  ]);
});

test('splitDescription understands the CLI em dash and spaced dash forms', () => {
  assert.deepEqual(splitDescription('Neon Bloom — Nova Hart'), {
    title: 'Neon Bloom',
    artist: 'Nova Hart',
  });
  assert.deepEqual(splitDescription('Neon Bloom - Nova Hart'), {
    title: 'Neon Bloom',
    artist: 'Nova Hart',
  });
  assert.deepEqual(splitDescription('Untitled'), { title: 'Untitled', artist: '' });
  assert.deepEqual(splitDescription(''), { title: '', artist: '' });
});

test('normalizeImageUrl converts Spotify image URIs to CDN URLs', () => {
  assert.equal(
    normalizeImageUrl('spotify:image:ab67616d00004851c8b444df094279e70d0ed856'),
    'https://i.scdn.co/image/ab67616d00004851c8b444df094279e70d0ed856',
  );
  assert.equal(normalizeImageUrl('https://i.scdn.co/image/abc'), 'https://i.scdn.co/image/abc');
  assert.equal(normalizeImageUrl('file:///C:/cover.png'), '');
  assert.equal(normalizeImageUrl(''), '');
});

test('normalizeImageUrl can request the largest artwork variant', () => {
  assert.equal(
    normalizeImageUrl('spotify:image:ab67616d00004851abc123', { large: true }),
    'https://i.scdn.co/image/ab67616d0000b273abc123',
  );
  assert.equal(
    normalizeImageUrl('https://i.scdn.co/image/ab67616d00001e02abc123', { large: true }),
    'https://i.scdn.co/image/ab67616d0000b273abc123',
  );
  assert.equal(
    upscaleImageUrl('https://mosaic.scdn.co/300/abc123'),
    'https://mosaic.scdn.co/640/abc123',
  );
  assert.equal(
    upscaleImageUrl('https://i.scdn.co/image/ab6761610000f178abc123'),
    'https://i.scdn.co/image/ab6761610000e5ebabc123',
  );
});

test('parseNowPlayingJson reads the current track and playback state', () => {
  const result = parseNowPlayingJson(
    JSON.stringify({
      currently_playing: {
        description: 'Neon Bloom — Nova Hart',
        uri: 'spotify:track:abc123',
        context_description: 'Afterglow',
        is_playing: false,
      },
    }),
  );

  assert.deepEqual(result, {
    current: {
      uri: 'spotify:track:abc123',
      title: 'Neon Bloom',
      artist: 'Nova Hart',
      context: 'Afterglow',
      isPlaying: false,
    },
  });
});

test('parseNowPlayingJson returns null when Spotify is idle', () => {
  assert.deepEqual(parseNowPlayingJson('{"currently_playing":null}'), { current: null });
  assert.deepEqual(parseNowPlayingJson('{}'), { current: null });
});

test('parseLookupJson normalizes track metadata and duration', () => {
  const entities = parseLookupJson(
    JSON.stringify({
      entities: [
        {
          uri: 'spotify:track:abc123',
          type: 'Song',
          name: 'Neon Bloom',
          parent: { name: 'Afterglow', uri: 'spotify:album:xyz' },
          contributors: [{ name: 'Nova Hart' }, { name: 'Iris June' }],
          image_url: 'https://i.scdn.co/image/cover',
          metadata: [{ field: 'duration', value: '222000' }],
        },
      ],
    }),
  );

  assert.deepEqual(entities, [
    {
      uri: 'spotify:track:abc123',
      title: 'Neon Bloom',
      artist: 'Nova Hart, Iris June',
      album: 'Afterglow',
      albumArt: 'https://i.scdn.co/image/cover',
      durationMs: 222000,
    },
  ]);
});

test('parseQueueJson reads upcoming tracks and ignores malformed entries', () => {
  const result = parseQueueJson(
    JSON.stringify({
      currently_playing: { uri: 'spotify:track:now' },
      next_tracks: [
        { uri: 'spotify:track:one', name: 'One', artist: 'Artist' },
        { uri: 'spotify:track:two', name: 'Two', artist: 'Artist 2', provider: 'context' },
        { name: 'Missing URI' },
      ],
      revision: 42,
    }),
  );

  assert.equal(result.revision, 42);
  assert.equal(result.upcoming.length, 2);
  assert.equal(result.upcoming[0].uri, 'spotify:track:one');
  assert.equal(result.upcoming[1].title, 'Two');
  assert.equal(result.upcoming[1].albumArt, '');
});

test('parseSearchJson normalizes search results and image URIs', () => {
  const results = parseSearchJson(
    JSON.stringify({
      tracks: [
        {
          uri: 'spotify:track:abc',
          name: 'Creep',
          artists: ['Radiohead'],
          image: 'spotify:image:coverhash',
        },
        {
          uri: 'spotify:episode:ignored',
          name: 'Not a track',
        },
      ],
    }),
  );

  assert.deepEqual(results, [
    {
      kind: 'track',
      uri: 'spotify:track:abc',
      title: 'Creep',
      artist: 'Radiohead',
      album: '',
      albumArt: 'https://i.scdn.co/image/coverhash',
      durationMs: 0,
    },
  ]);
});

test('parseSearchJson supports albums, artists, and playlists', () => {
  const albums = parseSearchJson(
    JSON.stringify({
      albums: [
        {
          uri: 'spotify:album:discovery',
          name: 'Discovery',
          artists: ['Daft Punk'],
          image: 'spotify:image:albumhash',
        },
      ],
    }),
    'album',
  );

  assert.equal(albums.length, 1);
  assert.equal(albums[0].kind, 'album');
  assert.equal(albums[0].title, 'Discovery');
  assert.equal(albums[0].artist, 'Daft Punk');

  const artists = parseSearchJson(
    JSON.stringify({
      artists: [{ uri: 'spotify:artist:daftpunk', name: 'Daft Punk', image: '' }],
    }),
    'artist',
  );
  assert.equal(artists[0].kind, 'artist');
  assert.equal(artists[0].albumArt, '');

  const playlists = parseSearchJson(
    JSON.stringify({
      playlists: [
        {
          uri: 'spotify:playlist:chill',
          name: 'Chill Mix',
          author: 'Spotify',
          image: 'https://i.scdn.co/image/playlist',
        },
      ],
    }),
    'playlist',
  );
  assert.equal(playlists[0].kind, 'playlist');
  assert.equal(playlists[0].artist, 'Spotify');
  assert.equal(playlists[0].albumArt, 'https://i.scdn.co/image/playlist');
});

test('parsePlaylistListJson keeps saved playlists only', () => {
  const playlists = parsePlaylistListJson(
    JSON.stringify({
      items: [
        { uri: 'spotify:playlist:one', name: 'Focus', type: 'playlist', artists: [] },
        { uri: 'spotify:artist:someone', name: 'Someone', type: 'artist', artists: [] },
        { uri: 'spotify:playlist:two', name: 'Gym', type: 'playlist', artists: [] },
      ],
    }),
  );

  assert.deepEqual(playlists, [
    { uri: 'spotify:playlist:one', name: 'Focus' },
    { uri: 'spotify:playlist:two', name: 'Gym' },
  ]);
});

test('parsePlaylistJson normalizes playlist details and tracks', () => {
  const playlist = parsePlaylistJson(
    JSON.stringify({
      uri: 'spotify:playlist:one',
      name: 'Focus',
      description: 'Deep work',
      track_count: 2,
      tracks: [
        {
          uri: 'spotify:track:first',
          name: 'First',
          artists: ['Artist One'],
          album: 'Album One',
          position: 0,
        },
        {
          uri: 'spotify:track:second',
          name: 'Second',
          artists: ['Artist Two'],
          album: 'Album Two',
          position: 1,
        },
      ],
    }),
  );

  assert.equal(playlist.name, 'Focus');
  assert.equal(playlist.trackCount, 2);
  assert.equal(playlist.description, 'Deep work');
  assert.equal(playlist.tracks.length, 2);
  assert.deepEqual(playlist.tracks[0], {
    uri: 'spotify:track:first',
    title: 'First',
    artist: 'Artist One',
    album: 'Album One',
    albumArt: '',
    durationMs: 0,
    position: 0,
  });
});

test('parseDeviceListJson finds the active device and its volume', () => {
  const device = parseDeviceListJson(
    JSON.stringify({
      active_device_id: 'device-2',
      devices: [
        { device_id: 'device-1', name: 'Phone', volume: 20, is_active: false },
        {
          device_id: 'device-2',
          name: 'This PC',
          device_type: 'computer',
          volume: 84,
          is_active: true,
          capabilities: { disable_volume: false },
        },
      ],
    }),
  );

  assert.deepEqual(device, {
    id: 'device-2',
    name: 'This PC',
    type: 'computer',
    volumePercent: 84,
    isRestricted: false,
  });
  assert.equal(parseDeviceListJson('{"devices":[]}'), null);
});

test('parseDeviceListJson falls back to the local device when nothing is active', () => {
  const device = parseDeviceListJson(
    JSON.stringify({
      active_device_id: '',
      devices: [
        {
          device_id: 'local-1',
          name: 'This PC',
          device_type: 'computer',
          volume: 83,
          is_active: false,
          is_self: true,
          is_local: true,
          capabilities: { disable_volume: false },
        },
      ],
    }),
  );

  assert.equal(device.name, 'This PC');
  assert.equal(device.volumePercent, 83);
  assert.equal(device.isRestricted, false);
});

test('parseStatusJson and parseVersionOutput read simple CLI responses', () => {
  assert.deepEqual(parseStatusJson('{"running":true,"logged_in":true}'), {
    running: true,
    loggedIn: true,
  });
  assert.deepEqual(parseStatusJson('{"running":false,"logged_in":false}'), {
    running: false,
    loggedIn: false,
  });
  assert.equal(
    parseVersionOutput('cli: 1.3.9.2055\nsuper-connect: v0.16.53\n'),
    '1.3.9.2055',
  );
  assert.equal(parseVersionOutput('unknown'), '');
});
