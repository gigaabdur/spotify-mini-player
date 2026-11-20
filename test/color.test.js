'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  extractAccentFromBitmap,
  rgbToHsl,
  hslToRgb,
  toHex,
} = require('../electron/lib/color');
const { FALLBACK_ACCENT } = require('../electron/lib/constants');

function bgraBitmap(pixels) {
  const buffer = Buffer.alloc(pixels.length * 4);
  pixels.forEach(([r, g, b, a = 255], index) => {
    buffer[index * 4] = b;
    buffer[index * 4 + 1] = g;
    buffer[index * 4 + 2] = r;
    buffer[index * 4 + 3] = a;
  });
  return buffer;
}

function closeTo(actual, expected, tolerance = 0.02) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

test('rgbToHsl converts primary colors', () => {
  const [redHue, redSaturation, redLightness] = rgbToHsl(255, 0, 0);
  closeTo(redHue, 0);
  closeTo(redSaturation, 1);
  closeTo(redLightness, 0.5);

  const [greenHue] = rgbToHsl(0, 255, 0);
  closeTo(greenHue, 120);

  const [blueHue] = rgbToHsl(0, 0, 255);
  closeTo(blueHue, 240);
});

test('rgbToHsl handles neutral and black colors', () => {
  assert.deepEqual(rgbToHsl(255, 255, 255), [0, 0, 1]);
  assert.deepEqual(rgbToHsl(0, 0, 0), [0, 0, 0]);
  assert.deepEqual(rgbToHsl(128, 128, 128), [0, 0, 128 / 255]);
});

test('hslToRgb round-trips primary colors', () => {
  assert.deepEqual(hslToRgb(0, 1, 0.5), [255, 0, 0]);
  assert.deepEqual(hslToRgb(120, 1, 0.5), [0, 255, 0]);
  assert.deepEqual(hslToRgb(240, 1, 0.5), [0, 0, 255]);
});

test('hslToRgb normalizes hues and clamps saturation and lightness', () => {
  assert.deepEqual(hslToRgb(480, 1, 0.5), hslToRgb(120, 1, 0.5));
  assert.deepEqual(hslToRgb(-240, 1, 0.5), hslToRgb(120, 1, 0.5));
  assert.deepEqual(hslToRgb(0, 4, 2), [255, 255, 255]);
  assert.deepEqual(hslToRgb(0, -1, -1), [0, 0, 0]);
});

test('toHex clamps channels and pads values', () => {
  assert.equal(toHex(255, 0, 0), '#ff0000');
  assert.equal(toHex(0, 0, 0), '#000000');
  assert.equal(toHex(300, -20, 12.6), '#ff000d');
  assert.equal(toHex(1, 2, 3), '#010203');
});

test('extractAccentFromBitmap falls back for empty input', () => {
  assert.equal(extractAccentFromBitmap(null, 0, 0), FALLBACK_ACCENT);
  assert.equal(extractAccentFromBitmap(Buffer.alloc(0), 0, 0), FALLBACK_ACCENT);
});

test('extractAccentFromBitmap ignores fully transparent pixels', () => {
  const bitmap = bgraBitmap([
    [255, 0, 0, 0],
    [0, 255, 0, 0],
  ]);
  assert.equal(extractAccentFromBitmap(bitmap, 2, 1), FALLBACK_ACCENT);
});

test('extractAccentFromBitmap falls back for grayscale artwork', () => {
  const bitmap = bgraBitmap([
    [120, 120, 120],
    [40, 40, 40],
    [220, 220, 220],
  ]);
  assert.equal(extractAccentFromBitmap(bitmap, 3, 1), FALLBACK_ACCENT);
});

test('extractAccentFromBitmap keeps the hue of a vivid cover', () => {
  const bitmap = bgraBitmap(
    Array.from({ length: 64 }, () => [51, 102, 255]),
  );
  const accent = extractAccentFromBitmap(bitmap, 64, 1);

  assert.match(accent, /^#[0-9a-f]{6}$/);

  const red = parseInt(accent.slice(1, 3), 16);
  const green = parseInt(accent.slice(3, 5), 16);
  const blue = parseInt(accent.slice(5, 7), 16);
  const [hue, saturation, lightness] = rgbToHsl(red, green, blue);

  closeTo(hue, 225, 2);
  assert.ok(saturation >= 0.5, 'accent should be saturated');
  assert.ok(lightness >= 0.44 && lightness <= 0.65, 'accent should be legible');
});

test('extractAccentFromBitmap ignores pixels below the alpha cutoff', () => {
  const bitmap = bgraBitmap([
    [255, 0, 0, 20],
    [255, 0, 0, 20],
  ]);
  assert.equal(extractAccentFromBitmap(bitmap, 2, 1), FALLBACK_ACCENT);
});

test('extractAccentFromBitmap tolerates a short buffer', () => {
  const bitmap = bgraBitmap([[255, 0, 0]]);
  const accent = extractAccentFromBitmap(bitmap, 100, 100);
  assert.match(accent, /^#[0-9a-f]{6}$/);
});
