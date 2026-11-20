'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { SpotifyService, isTrackUri } = require('../electron/lib/spotify-service');

function createFakeCli(responses) {
  const calls = [];

  const runCli = async (cliPath, args) => {
    calls.push({ cliPath, args });
    const handler = responses[args[0]];
    if (handler === undefined) {
      throw new Error(`Unexpected spotify_cli command: ${args.join(' ')}`);
    }
    return typeof handler === 'function' ? handler(args) : handler;
  };

  return { calls, runCli };
}

function createService(responses, options = {}) {
  const fake = createFakeCli(responses);
  const service = new SpotifyService({
    logger: { warn: () => {}, error: () => {}, log: () => {} },
    findCli: () => 'C:\\Spotify\\spotify_cli.exe',
    runCli: fake.runCli,
    openExternal: async () => {},
    ...options,
  });

  return { service, calls: fake.calls };
}

const NOW_PLAYING = JSON.stringify({
  currently_playing: {
    description: 'Neon Bloom — Nova Hart',
    uri: 'spotify:track:abc123',
    context_description: 'Afterglow',
    is_playing: true,
  },
});

const LOOKUP = JSON.stringify({
  entities: [
    {
      uri: 'spotify:track:abc123',
      name: 'Neon Bloom',
      parent: { name: 'Afterglow' },
      contributors: [{ name: 'Nova Hart' }],
      image_url: '',
      metadata: [{ field: 'duration', value: '222000' }],
    },
  ],
});

const DEVICES = JSON.stringify({
  active_device_id: 'device-1',
  devices: [
    {
      device_id: 'device-1',
      name: 'This PC',
      device_type: 'computer',
      volume: 84,
      is_active: true,
      capabilities: { disable_volume: false },
    },
  ],
});

test('SpotifyService starts against parsed CLI responses', async () => {
  const { service, calls } = createService({
    version: 'cli: 1.2.3\n',
    status: JSON.stringify({ running: true, logged_in: true }),
    'now-playing': NOW_PLAYING,
    lookup: LOOKUP,
    devices: DEVICES,
    queue: JSON.stringify({ next_tracks: [] }),
  });

  try {
    await service.start();
    const snapshot = service.snapshot();

    assert.equal(snapshot.status, 'online');
    assert.equal(snapshot.connection, 'online');
    assert.equal(snapshot.cli.available, true);
    assert.equal(snapshot.cli.version, '1.2.3');
    assert.equal(snapshot.playback.title, 'Neon Bloom');
    assert.equal(snapshot.playback.artist, 'Nova Hart');
    assert.equal(snapshot.playback.album, 'Afterglow');
    assert.equal(snapshot.playback.durationMs, 222000);
    assert.equal(snapshot.playback.isPlaying, true);
    assert.equal(snapshot.volume, 84);
    assert.equal(snapshot.playback.device.name, 'This PC');
    assert.ok(calls.some(({ args }) => args[0] === 'status'));
  } finally {
    service.stop();
  }
});

test('SpotifyService reports an offline state when Spotify is closed', async () => {
  const { service } = createService({
    version: 'cli: 1.2.3\n',
    status: JSON.stringify({ running: false, logged_in: false }),
  });

  try {
    await service.start();
    const snapshot = service.snapshot();
    assert.equal(snapshot.status, 'offline');
    assert.equal(snapshot.playback, null);
    assert.match(snapshot.notice.message, /Spotify is closed/);
  } finally {
    service.stop();
  }
});

test('SpotifyService sets volume through the working top-level command', async () => {
  const { service, calls } = createService({ volume: '' });
  service._cliPath = 'C:\\Spotify\\spotify_cli.exe';
  service._status = 'online';
  service._volume = 50;

  try {
    await service.setVolume(84);
    const volumeCall = calls.find(({ args }) => args[0] === 'volume');
    assert.deepEqual(volumeCall.args, ['volume', '0.84']);
    assert.equal(service.snapshot().volume, 84);
  } finally {
    service.stop();
  }
});

test('SpotifyService searches tracks and maps the CLI payload', async () => {
  const { service, calls } = createService({
    search: JSON.stringify({
      tracks: [
        {
          uri: 'spotify:track:2fuYa3Lx06QQJAm0MjztKr',
          name: 'Let Down',
          artists: ['Radiohead'],
          image: 'spotify:image:coverhash',
        },
      ],
    }),
  });
  service._cliPath = 'C:\\Spotify\\spotify_cli.exe';
  service._status = 'online';

  try {
    const results = await service.search('radiohead');
    assert.equal(results.length, 1);
    assert.equal(results[0].title, 'Let Down');
    assert.equal(results[0].artist, 'Radiohead');
    assert.equal(results[0].albumArt, 'https://i.scdn.co/image/coverhash');

    const searchCall = calls.find(({ args }) => args[0] === 'search');
    assert.deepEqual(searchCall.args, [
      'search',
      'radiohead',
      '--type',
      'track',
      '--limit',
      '12',
      '--format',
      'json',
    ]);
  } finally {
    service.stop();
  }
});

test('SpotifyService lists saved playlists with artwork from lookup', async () => {
  const { service, calls } = createService({
    library: JSON.stringify({
      items: [
        { uri: 'spotify:playlist:focus', name: 'Focus', type: 'playlist', artists: [] },
      ],
    }),
    lookup: JSON.stringify({
      entities: [
        {
          uri: 'spotify:playlist:focus',
          type: 'Playlist',
          name: 'Focus',
          image_url: 'https://i.scdn.co/image/focus',
        },
      ],
    }),
  });
  service._cliPath = 'C:\\Spotify\\spotify_cli.exe';
  service._status = 'online';

  try {
    const result = await service.getPlaylists({ force: true });
    assert.equal(result.playlists.length, 1);
    assert.equal(result.playlists[0].name, 'Focus');
    assert.equal(result.playlists[0].image, 'https://i.scdn.co/image/focus');

    const libraryCall = calls.find(({ args }) => args[0] === 'library');
    assert.deepEqual(libraryCall.args, [
      'library',
      'list',
      '--type',
      'playlist',
      '--limit',
      '60',
      '--format',
      'json',
    ]);
  } finally {
    service.stop();
  }
});

test('SpotifyService loads playlist tracks and enriches their metadata', async () => {
  const { service, calls } = createService({
    playlist: JSON.stringify({
      uri: 'spotify:playlist:focus',
      name: 'Focus',
      description: 'Deep work',
      track_count: 1,
      tracks: [
        {
          uri: 'spotify:track:first',
          name: 'First',
          artists: ['Artist One'],
          album: 'Album One',
          position: 0,
        },
      ],
    }),
    lookup: JSON.stringify({
      entities: [
        {
          uri: 'spotify:playlist:focus',
          type: 'Playlist',
          name: 'Focus',
          image_url: 'https://i.scdn.co/image/focus',
        },
        {
          uri: 'spotify:track:first',
          name: 'First',
          parent: { name: 'Album One' },
          contributors: [{ name: 'Artist One' }],
          image_url: 'https://i.scdn.co/image/first',
          metadata: [{ field: 'duration', value: '181000' }],
        },
      ],
    }),
  });
  service._cliPath = 'C:\\Spotify\\spotify_cli.exe';
  service._status = 'online';

  try {
    const detail = await service.getPlaylist('spotify:playlist:focus', { force: true });
    assert.equal(detail.name, 'Focus');
    assert.equal(detail.image, 'https://i.scdn.co/image/focus');
    assert.equal(detail.tracks.length, 1);
    assert.equal(detail.tracks[0].albumArt, 'https://i.scdn.co/image/first');
    assert.equal(detail.tracks[0].durationMs, 181000);

    const playlistCall = calls.find(({ args }) => args[0] === 'playlist');
    assert.deepEqual(playlistCall.args, [
      'playlist',
      'get',
      'spotify:playlist:focus',
      '--limit',
      '200',
      '--format',
      'json',
    ]);
  } finally {
    service.stop();
  }
});

test('SpotifyService seeks the current track and updates the position', async () => {
  const { service, calls } = createService({ seek: '' });
  service._cliPath = 'C:\\Spotify\\spotify_cli.exe';
  service._status = 'online';
  service._playback = {
    uri: 'spotify:track:first',
    title: 'First',
    artist: 'Artist',
    durationMs: 200000,
    isPlaying: false,
  };

  try {
    await service.seek(90000);
    const seekCall = calls.find(({ args }) => args[0] === 'seek');
    assert.deepEqual(seekCall.args, ['seek', '90000']);
    assert.equal(service.snapshot().playback.positionMs, 90000);
  } finally {
    service.stop();
  }
});

test('SpotifyService removes queue items by position', async () => {
  const { service, calls } = createService({
    queue: JSON.stringify({
      next_tracks: [
        { uri: 'spotify:track:one', name: 'One', artist: 'Artist' },
        { uri: 'spotify:track:two', name: 'Two', artist: 'Artist 2' },
      ],
    }),
  });
  service._cliPath = 'C:\\Spotify\\spotify_cli.exe';
  service._status = 'online';

  try {
    const queue = await service.removeFromQueue(0);
    assert.equal(queue.upcoming.length, 1);
    assert.equal(queue.upcoming[0].uri, 'spotify:track:two');

    const removeCall = calls.find(({ args }) => args[0] === 'queue' && args[1] === 'remove');
    assert.deepEqual(removeCall.args, ['queue', 'remove', '0']);
  } finally {
    service.stop();
  }
});

test('SpotifyService enriches artwork for the whole queue', async () => {
  const tracks = Array.from({ length: 20 }, (_, index) => ({
    uri: `spotify:track:${index}`,
    name: `Track ${index}`,
    artist: 'Artist',
  }));

  const { service, calls } = createService({
    queue: JSON.stringify({ next_tracks: tracks }),
    lookup: (args) => JSON.stringify({
      entities: args.slice(1, -2).map((uri) => ({
        uri,
        name: 'Track',
        parent: { name: 'Album' },
        contributors: [{ name: 'Artist' }],
        image_url: `https://i.scdn.co/image/${uri.split(':').pop()}`,
        metadata: [],
      })),
    }),
  });
  service._cliPath = 'C:\\Spotify\\spotify_cli.exe';
  service._status = 'online';

  try {
    const queue = await service.getQueue({ force: true, enrich: true });
    assert.equal(queue.upcoming.length, 20);
    assert.equal(
      queue.upcoming.filter((track) => track.albumArt).length,
      20,
    );

    const lookupCall = calls.find(({ args }) => args[0] === 'lookup');
    assert.equal(lookupCall.args.length, 23);
    assert.equal(lookupCall.args[1], 'spotify:track:0');
    assert.equal(lookupCall.args[20], 'spotify:track:19');
  } finally {
    service.stop();
  }
});

test('SpotifyService keeps cached artwork on unenriched queue refreshes', async () => {
  const { service } = createService({
    queue: JSON.stringify({
      next_tracks: [{ uri: 'spotify:track:one', name: 'One', artist: 'Artist' }],
    }),
  });
  service._cliPath = 'C:\\Spotify\\spotify_cli.exe';
  service._status = 'online';
  service._trackCache.set('spotify:track:one', {
    uri: 'spotify:track:one',
    title: 'One',
    artist: 'Artist',
    album: 'Album',
    albumArt: 'https://i.scdn.co/image/cover',
    durationMs: 0,
  });

  try {
    const queue = await service.getQueue({ force: true, enrich: false });
    assert.equal(queue.enriched, false);
    assert.equal(queue.upcoming[0].album, 'Album');
    assert.equal(queue.upcoming[0].albumArt, 'https://i.scdn.co/image/cover');
  } finally {
    service.stop();
  }
});

test('SpotifyService keeps the last playback when Spotify closes', () => {
  const { service } = createService({});
  service._cliPath = 'C:\\Spotify\\spotify_cli.exe';
  service._status = 'online';
  service._playback = {
    trackId: 'spotify:track:abc123',
    uri: 'spotify:track:abc123',
    type: 'track',
    title: 'Neon Bloom',
    artist: 'Nova Hart',
    album: 'Afterglow',
    albumArt: 'https://i.scdn.co/image/abc',
    accent: '#112233',
    isPlaying: true,
    durationMs: 222000,
    context: 'Afterglow',
    device: { name: 'This PC', volumePercent: 84 },
  };
  service._device = service._playback.device;
  service._volume = 84;
  service._queue = {
    upcoming: [{ uri: 'spotify:track:next', title: 'Next' }],
    updatedAt: Date.now(),
    enriched: true,
  };
  service._queueCount = 1;
  service._playlists = {
    playlists: [{ uri: 'spotify:playlist:focus', name: 'Focus' }],
    updatedAt: Date.now(),
  };
  service._playlistCache.set('spotify:playlist:focus', { name: 'Focus' });
  service._position = {
    trackId: 'spotify:track:abc123',
    positionMs: 60000,
    at: Date.now() - 5000,
    durationMs: 222000,
  };

  try {
    service._setOffline('Spotify is closed. Open the desktop app to connect.');
    const snapshot = service.snapshot();

    assert.equal(snapshot.status, 'offline');
    assert.equal(snapshot.playback.title, 'Neon Bloom');
    assert.equal(snapshot.playback.isPlaying, false);
    assert.equal(snapshot.playback.albumArt, 'https://i.scdn.co/image/abc');
    assert.equal(snapshot.playback.device.name, 'This PC');
    assert.equal(snapshot.volume, 84);
    assert.equal(snapshot.queueCount, 1);
    assert.ok(snapshot.playback.positionMs >= 65000);
    assert.ok(snapshot.playback.positionMs <= 66000);
    assert.equal(service._playlists.playlists[0].name, 'Focus');
  } finally {
    service.stop();
  }
});

test('SpotifyService stays offline when a poll times out with retained playback', async () => {
  const timeout = Object.assign(new Error('Spotify took too long to respond. Try again.'), {
    code: 'ETIMEDOUT',
  });
  const { service } = createService({
    'now-playing': () => {
      throw timeout;
    },
    devices: DEVICES,
  });
  service._cliPath = 'C:\\Spotify\\spotify_cli.exe';
  service._status = 'offline';
  service._notice = {
    kind: 'offline',
    message: 'Spotify is closed. Open the desktop app to connect.',
  };
  service._playback = {
    trackId: 'spotify:track:abc123',
    uri: 'spotify:track:abc123',
    title: 'Neon Bloom',
    artist: 'Nova Hart',
    album: 'Afterglow',
    albumArt: 'https://i.scdn.co/image/abc',
    accent: '#112233',
    isPlaying: false,
    durationMs: 222000,
    device: { name: 'This PC', volumePercent: 84 },
  };
  service._volume = 84;

  try {
    await service._pollOnce();
    const snapshot = service.snapshot();
    assert.equal(snapshot.status, 'offline');
    assert.deepEqual(snapshot.notice, {
      kind: 'offline',
      message: 'Spotify is closed. Open the desktop app to connect.',
    });
    assert.equal(snapshot.playback.title, 'Neon Bloom');
    assert.equal(snapshot.volume, 84);
  } finally {
    service.stop();
  }
});

test('SpotifyService does not reconnect on a status timeout while offline', async () => {
  const timeout = Object.assign(new Error('Spotify took too long to respond. Try again.'), {
    code: 'ETIMEDOUT',
  });
  const { service } = createService({
    status: () => {
      throw timeout;
    },
  });
  service._cliPath = 'C:\\Spotify\\spotify_cli.exe';
  service._status = 'offline';
  service._notice = {
    kind: 'offline',
    message: 'Spotify is closed. Open the desktop app to connect.',
  };
  service._playback = {
    trackId: 'spotify:track:abc123',
    uri: 'spotify:track:abc123',
    title: 'Neon Bloom',
    artist: 'Nova Hart',
    album: 'Afterglow',
    albumArt: 'https://i.scdn.co/image/abc',
    accent: '#112233',
    isPlaying: false,
    durationMs: 222000,
    device: { name: 'This PC', volumePercent: 84 },
  };
  service._volume = 84;

  try {
    await service._checkStatus();
    const snapshot = service.snapshot();
    assert.equal(snapshot.status, 'offline');
    assert.deepEqual(snapshot.notice, {
      kind: 'offline',
      message: 'Spotify is closed. Open the desktop app to connect.',
    });
    assert.equal(snapshot.playback.title, 'Neon Bloom');
  } finally {
    service.stop();
  }
});

test('isTrackUri accepts tracks and episodes only', () => {
  assert.equal(isTrackUri('spotify:track:abc123'), true);
  assert.equal(isTrackUri('spotify:episode:abc123'), true);
  assert.equal(isTrackUri('spotify:album:abc123'), false);
  assert.equal(isTrackUri('https://open.spotify.com/track/abc123'), false);
});
