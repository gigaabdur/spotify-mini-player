'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { WINDOW } = require('./constants');

const VIEW_MODES = new Set(['controls', 'default', 'cd']);

const DEFAULTS = Object.freeze({
  opacity: WINDOW.defaultOpacity,
  windowBounds: null,
  viewMode: 'default',
  showSongName: true,
});

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sanitize(value) {
  const input = isPlainObject(value) ? value : {};
  const next = { ...DEFAULTS };

  if (typeof input.opacity !== 'number' || !Number.isFinite(input.opacity)) {
    next.opacity = DEFAULTS.opacity;
  } else {
    next.opacity = Math.min(1, Math.max(WINDOW.minOpacity, input.opacity));
  }

  if (
    !isPlainObject(input.windowBounds) ||
    !Number.isFinite(input.windowBounds.x) ||
    !Number.isFinite(input.windowBounds.y)
  ) {
    next.windowBounds = null;
  } else {
    next.windowBounds = {
      x: Math.round(input.windowBounds.x),
      y: Math.round(input.windowBounds.y),
    };
  }

  next.viewMode = VIEW_MODES.has(input.viewMode) ? input.viewMode : DEFAULTS.viewMode;
  next.showSongName =
    typeof input.showSongName === 'boolean' ? input.showSongName : DEFAULTS.showSongName;

  return next;
}

/**
 * Small JSON store for non-secret preferences: window position and opacity.
 * The widget does not store Spotify credentials or tokens.
 */
class ConfigStore {
  constructor(filePath, { logger = console } = {}) {
    this.filePath = filePath;
    this.logger = logger;
    this.data = { ...DEFAULTS };
    this.saveTimer = null;
    this.dirty = false;
    this.load();
  }

  load() {
    try {
      if (!fs.existsSync(this.filePath)) return;
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      this.data = sanitize(parsed);
    } catch (error) {
      this.logger.warn(`[config] Could not read settings: ${error.message}`);
      this.data = { ...DEFAULTS };
    }
  }

  get(key, fallback) {
    return Object.prototype.hasOwnProperty.call(this.data, key)
      ? this.data[key]
      : fallback;
  }

  set(key, value) {
    if (JSON.stringify(this.data[key]) === JSON.stringify(value)) return;
    this.data[key] = value;
    this.dirty = true;
    this.scheduleSave();
  }

  scheduleSave() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.flush();
    }, 250);
    this.saveTimer.unref?.();
  }

  flush() {
    if (!this.dirty) return;

    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }

    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      const temporaryPath = `${this.filePath}.tmp`;
      fs.writeFileSync(temporaryPath, `${JSON.stringify(this.data, null, 2)}\n`, 'utf8');
      fs.renameSync(temporaryPath, this.filePath);
      this.dirty = false;
    } catch (error) {
      this.logger.warn(`[config] Could not save settings: ${error.message}`);
    }
  }
}

module.exports = { ConfigStore, DEFAULTS, sanitize };
