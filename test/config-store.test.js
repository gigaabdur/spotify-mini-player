'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { ConfigStore, DEFAULTS, sanitize } = require('../electron/lib/config-store');
const { WINDOW } = require('../electron/lib/constants');

function makeStore() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'smp-config-'));
  const filePath = path.join(directory, 'config.json');
  const warnings = [];
  const logger = { warn: (message) => warnings.push(message) };
  const store = new ConfigStore(filePath, { logger });
  return {
    directory,
    filePath,
    warnings,
    logger,
    store,
    cleanup: () => fs.rmSync(directory, { recursive: true, force: true }),
  };
}

test('sanitize returns defaults for invalid input', () => {
  for (const value of [null, undefined, 42, 'nope', []]) {
    assert.deepEqual(sanitize(value), { ...DEFAULTS });
  }
});

test('sanitize clamps opacity to the supported range', () => {
  assert.equal(sanitize({ opacity: 2 }).opacity, 1);
  assert.equal(sanitize({ opacity: 0 }).opacity, WINDOW.minOpacity);
  assert.equal(sanitize({ opacity: Number.NaN }).opacity, DEFAULTS.opacity);
  assert.equal(sanitize({ opacity: '0.5' }).opacity, DEFAULTS.opacity);
});

test('sanitize validates and rounds window bounds', () => {
  assert.deepEqual(sanitize({ windowBounds: { x: 10.4, y: 20.6 } }).windowBounds, {
    x: 10,
    y: 21,
  });
  assert.equal(sanitize({ windowBounds: { x: 10 } }).windowBounds, null);
  assert.equal(sanitize({ windowBounds: { x: '10', y: 20 } }).windowBounds, null);
  assert.equal(sanitize({ windowBounds: [] }).windowBounds, null);
});

test('sanitize drops legacy credential fields', () => {
  const sanitized = sanitize({ clientId: 'legacy-id', refreshToken: 'secret' });
  assert.equal('clientId' in sanitized, false);
  assert.equal('refreshToken' in sanitized, false);
});

test('ConfigStore starts with defaults when no file exists', () => {
  const context = makeStore();
  try {
    assert.equal(context.store.get('opacity'), DEFAULTS.opacity);
    assert.equal(context.store.get('windowBounds'), null);
    assert.equal(context.store.get('missing', 'fallback'), 'fallback');
  } finally {
    context.cleanup();
  }
});

test('ConfigStore persists values and reloads sanitized data', () => {
  const context = makeStore();
  try {
    context.store.set('opacity', 2);
    context.store.set('windowBounds', { x: 100.7, y: 200.2 });
    context.store.flush();

    const onDisk = JSON.parse(fs.readFileSync(context.filePath, 'utf8'));
    assert.equal(onDisk.opacity, 2, 'set() stores the raw value');

    const reloaded = new ConfigStore(context.filePath, { logger: context.logger });
    assert.equal(reloaded.get('opacity'), 1);
    assert.deepEqual(reloaded.get('windowBounds'), { x: 101, y: 200 });
  } finally {
    context.cleanup();
  }
});

test('ConfigStore recovers from invalid JSON', () => {
  const context = makeStore();
  try {
    fs.writeFileSync(context.filePath, '{not json', 'utf8');
    const store = new ConfigStore(context.filePath, { logger: context.logger });
    assert.equal(store.get('opacity'), DEFAULTS.opacity);
    assert.equal(context.warnings.length, 1);
    assert.match(context.warnings[0], /Could not read settings/);
  } finally {
    context.cleanup();
  }
});

test('ConfigStore ignores unchanged values and flushes atomically', () => {
  const context = makeStore();
  try {
    context.store.set('opacity', 0.8);
    context.store.flush();
    assert.equal(fs.existsSync(`${context.filePath}.tmp`), false);

    const before = fs.statSync(context.filePath).mtimeMs;
    context.store.set('opacity', 0.8);
    context.store.flush();
    assert.equal(fs.statSync(context.filePath).mtimeMs, before);
  } finally {
    context.cleanup();
  }
});
