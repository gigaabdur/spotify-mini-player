'use strict';

const { contextBridge, ipcRenderer } = require('electron');

/**
 * A deliberately tiny bridge. The renderer gets a fixed list of commands and
 * never receives ipcRenderer, Node.js, or arbitrary channel access.
 */
const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

function subscribe(channel, callback) {
  if (typeof callback !== 'function') return () => {};
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('spotifyWidget', {
  getState: () => invoke('spotify:get-state'),
  getSettings: () => invoke('settings:get'),

  togglePlayback: () => invoke('spotify:toggle'),
  next: () => invoke('spotify:next'),
  previous: () => invoke('spotify:previous'),
  setVolume: (value) => invoke('spotify:set-volume', value),
  refresh: () => invoke('spotify:refresh'),

  getQueue: (options) => invoke('spotify:get-queue', options),
  removeFromQueue: (position) => invoke('spotify:remove-from-queue', position),
  addToQueue: (uri) => invoke('spotify:add-to-queue', uri),
  search: (query, type) => invoke('spotify:search', query, type),
  playUri: (uri) => invoke('spotify:play-uri', uri),
  seek: (positionMs) => invoke('spotify:seek', positionMs),
  getPlaylists: (options) => invoke('spotify:get-playlists', options),
  getPlaylist: (uri, options) => invoke('spotify:get-playlist', uri, options),

  setOpacity: (value) => invoke('settings:set-opacity', value),
  setViewMode: (value) => invoke('settings:set-view-mode', value),
  setShowSongName: (value) => invoke('settings:set-show-song-name', value),

  hideWindow: () => invoke('window:hide'),
  moveWindowBy: (dx, dy) => invoke('window:move-by', dx, dy),
  moveWindowTo: (x, y) => invoke('window:move-to', x, y),
  quitApp: () => invoke('window:quit'),
  openSpotify: () => invoke('app:open-spotify'),
  openSpotifyDownload: () => invoke('app:open-spotify-download'),

  onState: (callback) => subscribe('spotify:state', callback),
  onUiChanged: (callback) => subscribe('ui:changed', callback),
  onToast: (callback) => subscribe('ui:toast', callback),
  onOpenSettings: (callback) => subscribe('ui:open-settings', callback),
  onOpenQueue: (callback) => subscribe('ui:open-queue', callback),
  onOpenSearch: (callback) => subscribe('ui:open-search', callback),
  onOpenPlaylists: (callback) => subscribe('ui:open-playlists', callback),
});
