'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseMediaSessionJson,
  normalizeTitle,
} = require('../electron/lib/media-position');

test('parseMediaSessionJson reads Spotify timeline data', () => {
  const result = parseMediaSessionJson(
    JSON.stringify({
      available: true,
      source: 'Spotify.exe',
      title: 'What You Know Bout Love',
      artist: 'Pop Smoke',
      positionMs: 813,
      startMs: 0,
      endMs: 160000,
      playing: 'Paused',
    }),
  );

  assert.deepEqual(result, {
    title: 'What You Know Bout Love',
    artist: 'Pop Smoke',
    positionMs: 813,
    durationMs: 160000,
    playing: false,
  });
});

test('parseMediaSessionJson reports playing state and clamps negative positions', () => {
  const result = parseMediaSessionJson(
    JSON.stringify({
      available: true,
      source: 'SpotifyAB.SpotifyMusic_zpdnekdrzrea0!Spotify',
      title: 'Neon Bloom',
      artist: 'Nova Hart',
      positionMs: -25,
      startMs: 0,
      endMs: 222000,
      playing: 'Playing',
    }),
  );

  assert.equal(result.positionMs, 0);
  assert.equal(result.durationMs, 222000);
  assert.equal(result.playing, true);
});

test('parseMediaSessionJson ignores other media apps and invalid payloads', () => {
  assert.equal(
    parseMediaSessionJson(
      JSON.stringify({
        available: true,
        source: 'Brave',
        title: 'Instagram',
        positionMs: 1000,
        startMs: 0,
        endMs: 71900,
        playing: 'Playing',
      }),
    ),
    null,
  );
  assert.equal(parseMediaSessionJson('{"available":false}'), null);
  assert.equal(parseMediaSessionJson('not json'), null);
  assert.equal(parseMediaSessionJson(''), null);
});

test('normalizeTitle folds punctuation and spacing for track matching', () => {
  assert.equal(normalizeTitle('What You Know Bout Love'), 'what you know bout love');
  assert.equal(normalizeTitle('  What You Know — Bout Love  '), 'what you know bout love');
  assert.equal(normalizeTitle(''), '');
});
