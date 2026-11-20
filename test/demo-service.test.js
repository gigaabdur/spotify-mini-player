'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { DemoService } = require('../electron/lib/demo-service');

function createDemo(options) {
  const service = new DemoService(options);
  service.on('state', () => {});
  return service;
}

test('DemoService exposes playback, queue, and volume', async () => {
  const service = createDemo();
  try {
    await service.start();
    const snapshot = service.snapshot();

    assert.equal(snapshot.status, 'online');
    assert.equal(snapshot.playback.title, 'Neon Bloom');
    assert.equal(snapshot.playback.isPlaying, true);
    assert.equal(snapshot.queueCount, 5);
    assert.equal(snapshot.volume, 72);
    assert.equal(snapshot.cli.available, true);

    const queue = await service.getQueue();
    assert.equal(queue.upcoming.length, 5);
    assert.equal(queue.upcoming[0].title, 'Midnight Drive');
  } finally {
    service.stop();
  }
});

test('DemoService controls playback and queue items', async () => {
  const service = createDemo();
  try {
    await service.start();
    await service.togglePlayback();
    assert.equal(service.snapshot().playback.isPlaying, false);

    const queue = await service.getQueue();
    const target = queue.upcoming[0];
    await service.removeFromQueue(0);
    assert.equal(service.snapshot().queueCount, 4);

    await service.playUri(target.uri);
    assert.equal(service.snapshot().playback.title, target.title);

    await service.addToQueue(service.tracks[4].uri);
    assert.equal(service.snapshot().queueCount, 5);
  } finally {
    service.stop();
  }
});

test('DemoService searches tracks by title, artist, or album', async () => {
  const service = createDemo();
  try {
    await service.start();
    const byArtist = await service.search('nova');
    const byAlbum = await service.search('nightfall');
    const empty = await service.search('');

    assert.equal(byArtist[0].title, 'Neon Bloom');
    assert.equal(byAlbum[0].title, 'After Hours');
    assert.deepEqual(empty, []);
  } finally {
    service.stop();
  }
});

test('DemoService reports an offline state without credentials', async () => {
  const service = createDemo({ offline: true });
  try {
    await service.start();
    const snapshot = service.snapshot();
    assert.equal(snapshot.status, 'offline');
    assert.equal(snapshot.playback, null);
    assert.equal(snapshot.queueCount, 0);
    assert.equal(snapshot.cli.available, false);
    assert.match(snapshot.notice.message, /Spotify is closed/);

    await assert.rejects(service.togglePlayback(), { code: 'SPOTIFY_NOT_RUNNING' });
  } finally {
    service.stop();
  }
});

test('DemoService validates volume and queue positions', async () => {
  const service = createDemo();
  try {
    await service.start();
    await assert.rejects(service.setVolume('nope'), { code: 'INVALID_VOLUME' });
    await assert.rejects(service.removeFromQueue(99), { code: 'INVALID_QUEUE_POSITION' });
    await assert.rejects(service.addToQueue('spotify:track:missing'), { code: 'INVALID_TRACK' });
  } finally {
    service.stop();
  }
});
