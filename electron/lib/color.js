'use strict';

const { FALLBACK_ACCENT } = require('./constants');

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function rgbToHsl(r, g, b) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const lightness = (max + min) / 2;

  let hue = 0;
  let saturation = 0;

  if (delta !== 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));
    switch (max) {
      case red:
        hue = 60 * (((green - blue) / delta) % 6);
        break;
      case green:
        hue = 60 * ((blue - red) / delta + 2);
        break;
      default:
        hue = 60 * ((red - green) / delta + 4);
        break;
    }
  }

  if (hue < 0) hue += 360;
  return [hue, saturation, lightness];
}

function hslToRgb(hue, saturation, lightness) {
  const h = ((hue % 360) + 360) % 360;
  const s = clamp(saturation, 0, 1);
  const l = clamp(lightness, 0, 1);
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let rgb;
  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];

  return rgb.map((channel) => Math.round((channel + m) * 255));
}

function toHex(r, g, b) {
  return `#${[r, g, b]
    .map((channel) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, '0'))
    .join('')}`;
}

/**
 * Finds a vivid, useful accent from BGRA bitmap data (Windows native format).
 * Neutral / monochrome covers deliberately fall back to Spotify green.
 */
function extractAccentFromBitmap(bitmap, width, height) {
  if (!bitmap || !width || !height) return FALLBACK_ACCENT;

  const bucketCount = 24;
  const buckets = Array.from({ length: bucketCount }, () => ({
    weight: 0,
    r: 0,
    g: 0,
    b: 0,
  }));

  let vividWeight = 0;
  let grayWeight = 0;
  let grayR = 0;
  let grayG = 0;
  let grayB = 0;
  const pixelCount = Math.min(Math.floor(bitmap.length / 4), width * height);

  for (let index = 0; index < pixelCount; index += 1) {
    const offset = index * 4;
    const b = bitmap[offset];
    const g = bitmap[offset + 1];
    const r = bitmap[offset + 2];
    const a = bitmap[offset + 3];

    if (a < 96) continue;

    const [hue, saturation, lightness] = rgbToHsl(r, g, b);

    if (saturation < 0.14 || lightness < 0.07 || lightness > 0.94) {
      grayWeight += 1;
      grayR += r;
      grayG += g;
      grayB += b;
      continue;
    }

    // Favor saturated mid-tones. Very dark or washed-out pixels contribute less.
    const midTone = 1 - Math.abs(lightness - 0.52) * 1.8;
    const weight = Math.pow(saturation, 1.35) * (0.25 + Math.max(0, midTone));
    const bucket = buckets[Math.floor(hue / (360 / bucketCount)) % bucketCount];

    bucket.weight += weight;
    bucket.r += r * weight;
    bucket.g += g * weight;
    bucket.b += b * weight;
    vividWeight += weight;
  }

  if (vividWeight < 24) {
    // A mostly grayscale cover still gets a deliberate accent rather than an
    // accidental muddy color.
    if (grayWeight > 0) {
      const [hue, saturation, lightness] = rgbToHsl(
        grayR / grayWeight,
        grayG / grayWeight,
        grayB / grayWeight,
      );
      if (saturation > 0.08) {
        return toHex(...hslToRgb(hue, Math.max(0.52, saturation), clamp(lightness, 0.46, 0.6)));
      }
    }
    return FALLBACK_ACCENT;
  }

  let winner = buckets[0];
  for (const bucket of buckets) {
    if (bucket.weight > winner.weight) winner = bucket;
  }

  if (!winner.weight) return FALLBACK_ACCENT;

  const averageR = winner.r / winner.weight;
  const averageG = winner.g / winner.weight;
  const averageB = winner.b / winner.weight;
  const [hue, saturation, lightness] = rgbToHsl(averageR, averageG, averageB);

  // Normalize the accent for UI use: saturated enough to read as an accent,
  // and light enough to remain legible on the dark glass surface.
  const accentSaturation = clamp(Math.max(saturation, 0.56), 0.52, 0.9);
  const accentLightness = clamp(lightness, 0.46, 0.63);

  return toHex(...hslToRgb(hue, accentSaturation, accentLightness));
}

module.exports = {
  extractAccentFromBitmap,
  rgbToHsl,
  hslToRgb,
  toHex,
};
