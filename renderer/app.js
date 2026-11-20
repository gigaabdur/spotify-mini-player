'use strict';

const api = window.spotifyWidget;
const FALLBACK_ACCENT = '#1db954';

const el = (id) => document.getElementById(id);

const elements = {
  app: el('app'),
  viewSwitcher: el('viewSwitcher'),
  songNameToggleButton: el('songNameToggleButton'),
  cdStage: el('cdStage'),
  cdOrbit: el('cdOrbit'),
  cdOrbitText: el('cdOrbitText'),
  cdDisc: el('cdDisc'),
  cdArt: el('cdArt'),
  cdTitle: el('cdTitle'),
  cdArtist: el('cdArtist'),
  cdSlotTop: el('cdSlotTop'),
  cdSlotUpperLeft: el('cdSlotUpperLeft'),
  cdSlotUpperRight: el('cdSlotUpperRight'),
  cdSlotLeft: el('cdSlotLeft'),
  cdSlotRight: el('cdSlotRight'),
  cdSlotLowerLeft: el('cdSlotLowerLeft'),
  cdSlotBottom: el('cdSlotBottom'),
  cdSlotLowerRight: el('cdSlotLowerRight'),
  backdropA: el('backdropA'),
  backdropB: el('backdropB'),
  content: el('content'),
  playerBottom: el('playerBottom'),
  settingsButton: el('settingsButton'),
  playlistsButton: el('playlistsButton'),
  hideButton: el('hideButton'),

  loadingView: el('loadingView'),
  unavailableView: el('unavailableView'),
  playerView: el('playerView'),
  downloadSpotifyButton: el('downloadSpotifyButton'),
  retrySetupButton: el('retrySetupButton'),

  emptyState: el('emptyState'),
  emptyTitle: el('emptyTitle'),
  emptyText: el('emptyText'),
  emptyOpenSpotify: el('emptyOpenSpotify'),
  emptySearchButton: el('emptySearchButton'),
  emptyRefresh: el('emptyRefresh'),

  trackMeta: el('trackMeta'),
  trackTitle: el('trackTitle'),
  trackArtist: el('trackArtist'),
  progressSlider: el('progressSlider'),
  elapsedTime: el('elapsedTime'),
  remainingTime: el('remainingTime'),

  previousButton: el('previousButton'),
  playButton: el('playButton'),
  nextButton: el('nextButton'),
  volumeButton: el('volumeButton'),
  moreButton: el('moreButton'),
  infoButton: el('infoButton'),
  queueButton: el('queueButton'),
  queueCount: el('queueCount'),

  volumePopover: el('volumePopover'),
  volumeSlider: el('volumeSlider'),
  volumeValue: el('volumeValue'),
  moreMenu: el('moreMenu'),
  menuOpenSpotify: el('menuOpenSpotify'),
  menuRefresh: el('menuRefresh'),
  menuSettings: el('menuSettings'),
  menuHide: el('menuHide'),
  menuQuit: el('menuQuit'),
  infoPopover: el('infoPopover'),
  infoAlbum: el('infoAlbum'),
  infoDevice: el('infoDevice'),
  infoContext: el('infoContext'),
  infoQueue: el('infoQueue'),

  toast: el('toast'),
  toastText: el('toastText'),
  sheetBackdrop: el('sheetBackdrop'),

  searchSheet: el('searchSheet'),
  closeSearchButton: el('closeSearchButton'),
  openSearchButton: el('openSearchButton'),
  searchPillText: el('searchPillText'),
  searchPillKey: el('searchPillKey'),
  searchInput: el('searchInput'),
  clearSearchButton: el('clearSearchButton'),
  searchFilters: el('searchFilters'),
  searchResults: el('searchResults'),
  searchStatus: el('searchStatus'),

  queueSheet: el('queueSheet'),
  closeQueueButton: el('closeQueueButton'),
  queueSubtitle: el('queueSubtitle'),
  queueNow: el('queueNow'),
  queueList: el('queueList'),
  queueEmpty: el('queueEmpty'),
  queueEmptyText: el('queueEmptyText'),
  queueRetryButton: el('queueRetryButton'),
  refreshQueueButton: el('refreshQueueButton'),

  playlistsSheet: el('playlistsSheet'),
  closePlaylistsButton: el('closePlaylistsButton'),
  playlistsTitle: el('playlistsTitle'),
  playlistsSubtitle: el('playlistsSubtitle'),
  refreshPlaylistsButton: el('refreshPlaylistsButton'),
  playlistsList: el('playlistsList'),
  playlistDetail: el('playlistDetail'),
  playlistDetailImage: el('playlistDetailImage'),
  playlistDetailName: el('playlistDetailName'),
  playlistDetailMeta: el('playlistDetailMeta'),
  playPlaylistButton: el('playPlaylistButton'),
  playlistTracks: el('playlistTracks'),
  playlistsStatus: el('playlistsStatus'),

  settingsSheet: el('settingsSheet'),
  closeSettingsButton: el('closeSettingsButton'),
  opacitySlider: el('opacitySlider'),
  transparencyValue: el('transparencyValue'),
  transparencyHint: el('transparencyHint'),
  settingsStatusDot: el('settingsStatusDot'),
  settingsStatus: el('settingsStatus'),
  settingsStatusHint: el('settingsStatusHint'),
  localControl: el('localControl'),
  cliVersionText: el('cliVersionText'),
  settingsRefreshButton: el('settingsRefreshButton'),
  settingsOpenSpotifyButton: el('settingsOpenSpotifyButton'),
  versionText: el('versionText'),
  materialText: el('materialText'),
  hideToTrayButton: el('hideToTrayButton'),
  quitButton: el('quitButton'),
  demoNote: el('demoNote'),
};

const state = {
  snapshot: null,
  settings: null,
  ui: { theme: 'dark', material: 'fallback', demo: false, searchQuery: '' },
  currentView: 'loading',
  viewMode: 'default',
  showSongName: true,
  artworkUrl: '',
  frontArtwork: null,
  accent: '',
  artAccent: FALLBACK_ACCENT,
  lastTrackKey: '',
  metaTimer: null,

  volumeHoldUntil: 0,
  pendingVolume: null,
  lastVolumeSent: null,
  volumeTimer: null,
  volumeCloseTimer: null,
  volumeHoverOpened: false,

  drag: null,

  opacityTimer: null,
  pendingOpacity: null,

  toastTimer: null,
  toastHideTimer: null,

  sheet: null,
  lastFocusBeforeSheet: null,
  popover: null,

  queue: null,
  queueLoading: false,
  queueError: '',

  searchQuery: '',
  searchType: 'track',
  searchResults: [],
  searchLoading: false,
  searchError: '',
  searchSeq: 0,
  searchTimer: null,
  pendingSheet: '',

  playlists: null,
  playlistsLoading: false,
  playlistsError: '',
  playlistUri: '',
  playlistDetail: null,
  playlistLoading: false,
  playlistError: '',

  progress: {
    trackId: '',
    positionMs: 0,
    durationMs: 0,
    at: 0,
    playing: false,
    dragging: false,
  },
  progressTimer: null,
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function isHexColor(value) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}

function relativeLuminance(hex) {
  const channels = [1, 3, 5].map((index) => {
    const value = parseInt(hex.slice(index, index + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

const THEME_VARIABLES = [
  '--text',
  '--muted',
  '--muted-strong',
  '--surface',
  '--surface-hover',
  '--surface-strong',
  '--border',
  '--border-strong',
  '--input-bg',
  '--track-bg',
  '--progress-fill',
  '--progress-track',
  '--range-fill',
  '--highlight',
  '--shadow',
  '--sheet-bg',
  '--toast-bg',
  '--toast-text',
  '--app-bg-fallback',
  '--player-text',
  '--player-muted',
  '--player-shadow',
  '--danger',
  '--warning',
  '--glass-tint-gradient',
  '--top-gradient',
  '--bottom-gradient',
  '--state-card-bg',
];

const SKIN_VARIABLES = [
  '--skin-font',
  '--skin-subtitle-font',
  '--skin-play-image',
  '--skin-play-bg',
  '--skin-play-border',
  '--skin-play-shadow',
  '--skin-progress-track',
  '--skin-progress-track-shadow',
  '--skin-progress-thumb',
  '--skin-progress-thumb-shadow',
  '--skin-card-bg',
  '--skin-card-border',
  '--skin-card-radius',
  '--skin-button-radius',
  '--skin-scrollbar',
  '--skin-scrollbar-track',
  '--skin-scrollbar-radius',
  '--skin-art-border',
  '--skin-art-shadow',
  '--skin-glow',
];

function hexToRgba(value, alpha) {
  const hex = isHexColor(value) ? value : '#000000';
  const red = parseInt(hex.slice(1, 3), 16);
  const green = parseInt(hex.slice(3, 5), 16);
  const blue = parseInt(hex.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function clearThemePalette() {
  const style = document.documentElement.style;
  for (const property of THEME_VARIABLES) style.removeProperty(property);
  delete document.documentElement.dataset.themeSource;
  clearThemeSkin();
}

function clearThemeSkin() {
  const style = document.documentElement.style;
  for (const property of SKIN_VARIABLES) style.removeProperty(property);
  delete document.documentElement.dataset.themeSkin;
  delete document.documentElement.dataset.skinCrest;
}

function applyThemeSkin(skin) {
  clearThemeSkin();
  if (!skin || typeof skin !== 'object') return;

  const map = {
    '--skin-font': skin.font,
    '--skin-subtitle-font': skin.subtitleFont,
    '--skin-play-image': skin.playImage,
    '--skin-play-bg': skin.playBackground,
    '--skin-play-border': skin.playBorder,
    '--skin-play-shadow': skin.playShadow,
    '--skin-progress-track': skin.progressTrack,
    '--skin-progress-track-shadow': skin.progressTrackShadow,
    '--skin-progress-thumb': skin.progressThumb,
    '--skin-progress-thumb-shadow': skin.progressThumbShadow,
    '--skin-card-bg': skin.cardBackground,
    '--skin-card-border': skin.cardBorder,
    '--skin-card-radius': skin.cardRadius,
    '--skin-button-radius': skin.buttonRadius,
    '--skin-scrollbar': skin.scrollbar,
    '--skin-scrollbar-track': skin.scrollbarTrack,
    '--skin-scrollbar-radius': skin.scrollbarRadius,
    '--skin-art-border': skin.artworkBorder,
    '--skin-art-shadow': skin.artworkShadow,
    '--skin-glow': skin.glow,
  };

  const style = document.documentElement.style;
  let any = false;
  for (const [property, value] of Object.entries(map)) {
    if (typeof value === 'string' && value.trim()) {
      style.setProperty(property, value);
      any = true;
    }
  }

  if (any) {
    document.documentElement.dataset.themeSkin = 'spicetify';
    if (skin.playImage) document.documentElement.dataset.skinCrest = 'true';
  }
}

function applyThemePalette(palette) {
  if (
    !palette ||
    typeof palette !== 'object' ||
    !isHexColor(palette.background) ||
    !isHexColor(palette.text)
  ) {
    clearThemePalette();
    return;
  }

  const dark = palette.mode !== 'light';
  const main = palette.background;
  const sidebar = isHexColor(palette.sidebar) ? palette.sidebar : main;
  const elevated = isHexColor(palette.backgroundElevated)
    ? palette.backgroundElevated
    : main;
  const text = palette.text;
  const subtext = isHexColor(palette.subtext) ? palette.subtext : text;
  const highlight = isHexColor(palette.highlight) ? palette.highlight : elevated;
  const highlightElevated = isHexColor(palette.highlightElevated)
    ? palette.highlightElevated
    : highlight;
  const shadow = isHexColor(palette.shadow) ? palette.shadow : '#000000';
  const accent = isHexColor(palette.accent) ? palette.accent : FALLBACK_ACCENT;
  const notification = isHexColor(palette.notification)
    ? palette.notification
    : accent;
  const notificationError = isHexColor(palette.notificationError)
    ? palette.notificationError
    : '#f87171';
  const playbackBar = isHexColor(palette.playbackBar)
    ? palette.playbackBar
    : palette.accent;

  const values = {
    '--text': text,
    '--muted': hexToRgba(subtext, dark ? 0.6 : 0.56),
    '--muted-strong': hexToRgba(subtext, dark ? 0.82 : 0.76),
    '--surface': hexToRgba(highlight, dark ? 0.55 : 0.52),
    '--surface-hover': hexToRgba(highlightElevated, dark ? 0.8 : 0.76),
    '--surface-strong': hexToRgba(highlightElevated, dark ? 0.7 : 0.68),
    '--border': hexToRgba(text, dark ? 0.1 : 0.09),
    '--border-strong': hexToRgba(text, dark ? 0.16 : 0.14),
    '--input-bg': hexToRgba(highlight, dark ? 0.55 : 0.62),
    '--track-bg': hexToRgba(text, dark ? 0.2 : 0.15),
    '--progress-fill': playbackBar,
    '--progress-track': hexToRgba(subtext, dark ? 0.28 : 0.2),
    '--range-fill': accent,
    '--highlight': dark ? 'rgba(255, 255, 255, 0.09)' : 'rgba(255, 255, 255, 0.85)',
    '--shadow': hexToRgba(shadow, dark ? 0.5 : 0.22),
    '--sheet-bg': hexToRgba(main, dark ? 0.44 : 0.62),
    '--toast-bg': hexToRgba(elevated, 0.97),
    '--toast-text': text,
    '--app-bg-fallback': `linear-gradient(158deg, ${hexToRgba(main, 0.97)}, ${hexToRgba(sidebar, 0.99)})`,
    '--player-text': text,
    '--player-muted': hexToRgba(subtext, dark ? 0.72 : 0.6),
    '--player-shadow': dark ? '0 1px 7px rgba(0, 0, 0, 0.55)' : 'none',
    '--danger': dark ? notificationError : `color-mix(in srgb, ${notificationError} 68%, black)`,
    '--warning': dark ? notification : `color-mix(in srgb, ${notification} 60%, black)`,
    '--glass-tint-gradient': `linear-gradient(155deg, ${hexToRgba(main, 0.62)}, ${hexToRgba(sidebar, 0.82)})`,
    '--top-gradient': `linear-gradient(180deg, ${hexToRgba(main, dark ? 0.28 : 0.35)}, ${hexToRgba(main, 0.01)} 72%, ${hexToRgba(main, 0)})`,
    '--bottom-gradient': `linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.05) 20%, rgba(255, 255, 255, 0.15) 54%, rgba(255, 255, 255, 0.26) 100%), linear-gradient(180deg, ${hexToRgba(main, 0)} 18%, ${hexToRgba(main, dark ? 0.12 : 0.18)} 56%, ${hexToRgba(main, dark ? 0.3 : 0.35)} 100%)`,
    '--state-card-bg': hexToRgba(elevated, dark ? 0.58 : 0.72),
  };

  const style = document.documentElement.style;
  for (const [property, value] of Object.entries(values)) {
    style.setProperty(property, value);
  }
  document.documentElement.dataset.themeSource = 'spicetify';
}

async function call(method, ...args) {
  if (!api || typeof api[method] !== 'function') {
    throw new Error('The app bridge is unavailable. Restart Spotify Mini Player.');
  }

  let response;
  try {
    response = await api[method](...args);
  } catch (error) {
    throw new Error(error?.message || 'The app could not complete that request.');
  }

  if (!response || response.ok !== true) {
    const error = new Error(response?.error?.message || 'Something went wrong. Please try again.');
    error.code = response?.error?.code || 'UNKNOWN';
    throw error;
  }

  return response.data;
}

function bindEvents() {
  elements.openSearchButton.addEventListener('click', handleSearchPill);
  elements.settingsButton.addEventListener('click', openSettings);
  elements.playlistsButton.addEventListener('click', openPlaylists);
  elements.hideButton.addEventListener('click', hideWidget);

  elements.closeSettingsButton.addEventListener('click', closeSettings);
  elements.closeQueueButton.addEventListener('click', closeQueue);
  elements.closeSearchButton.addEventListener('click', closeSearch);
  elements.closePlaylistsButton.addEventListener('click', closePlaylists);
  elements.sheetBackdrop.addEventListener('click', () => closeSheet());

  elements.playButton.addEventListener('click', togglePlayback);
  elements.previousButton.addEventListener('click', skipPrevious);
  elements.nextButton.addEventListener('click', skipNext);

  elements.volumeButton.addEventListener('click', (event) => {
    event.stopPropagation();
    cancelVolumeClose();
    if (state.popover === 'volume') {
      if (state.volumeHoverOpened && event.detail > 0) {
        // Hover already opened it; a click pins the slider instead of closing it.
        elements.volumeSlider.focus({ preventScroll: true });
        return;
      }
      closePopovers();
      return;
    }
    openPopover('volume');
  });
  elements.volumeButton.addEventListener('mouseenter', () => {
    if (elements.volumeButton.disabled) return;
    cancelVolumeClose();
    if (state.popover !== 'volume') {
      openPopover('volume');
      state.volumeHoverOpened = true;
    }
  });
  elements.volumeButton.addEventListener('mouseleave', scheduleVolumeClose);
  elements.volumePopover.addEventListener('mouseenter', cancelVolumeClose);
  elements.volumePopover.addEventListener('mouseleave', scheduleVolumeClose);
  elements.moreButton.addEventListener('click', (event) => {
    event.stopPropagation();
    togglePopover('more');
  });
  elements.infoButton.addEventListener('click', (event) => {
    event.stopPropagation();
    togglePopover('info');
  });
  elements.queueButton.addEventListener('click', openQueue);

  elements.volumeSlider.addEventListener('input', onVolumeInput);
  elements.volumeSlider.addEventListener('change', flushVolume);

  elements.progressSlider.addEventListener('input', onProgressInput);
  elements.progressSlider.addEventListener('change', onProgressChange);

  elements.emptyRefresh.addEventListener('click', refreshPlayback);
  elements.emptyOpenSpotify.addEventListener('click', openSpotify);
  elements.emptySearchButton.addEventListener('click', openSearchSheet);
  elements.downloadSpotifyButton.addEventListener('click', openSpotifyDownload);
  elements.retrySetupButton.addEventListener('click', retrySetup);
  elements.settingsRefreshButton.addEventListener('click', retrySetup);
  elements.settingsOpenSpotifyButton.addEventListener('click', openSpotify);

  elements.opacitySlider.addEventListener('input', onOpacityInput);
  elements.opacitySlider.addEventListener('change', flushOpacity);

  elements.menuOpenSpotify.addEventListener('click', () => {
    closePopovers();
    openSpotify();
  });
  elements.menuRefresh.addEventListener('click', () => {
    closePopovers();
    refreshPlayback();
  });
  elements.menuSettings.addEventListener('click', () => {
    closePopovers();
    openSettings();
  });
  elements.menuHide.addEventListener('click', () => {
    closePopovers();
    hideWidget();
  });
  elements.menuQuit.addEventListener('click', () => {
    closePopovers();
    call('quitApp').catch((error) => showToast(error.message, 'error'));
  });

  elements.hideToTrayButton.addEventListener('click', hideWidget);
  elements.quitButton.addEventListener('click', () => {
    call('quitApp').catch((error) => showToast(error.message, 'error'));
  });

  elements.refreshQueueButton.addEventListener('click', () => refreshQueue({ force: true }));
  elements.queueRetryButton.addEventListener('click', () => refreshQueue({ force: true }));
  elements.refreshPlaylistsButton.addEventListener('click', () => loadPlaylists({ force: true }));
  elements.playPlaylistButton.addEventListener('click', playPlaylist);

  elements.searchInput.addEventListener('input', onSearchInput);
  elements.searchInput.addEventListener('keydown', onSearchKeyDown);
  elements.clearSearchButton.addEventListener('click', clearSearch);
  elements.searchFilters.addEventListener('click', onFilterClick);
  elements.searchResults.addEventListener('click', onResultListClick);
  elements.playlistsList.addEventListener('click', onPlaylistsListClick);
  elements.playlistTracks.addEventListener('click', onPlaylistTracksClick);
  elements.playlistDetailImage.addEventListener('error', () => {
    elements.playlistDetailImage.style.visibility = 'hidden';
  });

  if (elements.viewSwitcher) {
    elements.viewSwitcher.addEventListener('click', (event) => {
      const button = event.target.closest('[data-view]');
      if (!button) return;
      if (elements.settingsSheet?.classList.contains('is-open')) {
        closeSheet();
      }
      setWidgetView(button.dataset.view);
    });
  }
  if (elements.songNameToggleButton) {
    elements.songNameToggleButton.addEventListener('click', (event) => {
      event.stopPropagation();
      setShowSongName(!state.showSongName);
    });
  }

  document.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
    const blocked = event.target.closest(
      'button, input, textarea, select, a, [role="button"], .sheet, .popover, .sheet-backdrop',
    );
    if (blocked) return;
    state.drag = {
      startX: event.screenX,
      startY: event.screenY,
      // screenX/clientX gives the window's content origin, which is what
      // BrowserWindow.setPosition expects for a frameless resizable window.
      windowX: event.screenX - event.clientX,
      windowY: event.screenY - event.clientY,
      targetX: 0,
      targetY: 0,
      frame: null,
      moved: false,
    };
    document.body.classList.add('is-dragging');
    event.preventDefault();
  });

  document.addEventListener('mousemove', (event) => {
    const drag = state.drag;
    if (!drag) return;
    const dx = event.screenX - drag.startX;
    const dy = event.screenY - drag.startY;
    if (!drag.moved && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
    drag.moved = true;
    drag.targetX = Math.round(drag.windowX + dx);
    drag.targetY = Math.round(drag.windowY + dy);
    if (drag.frame) return;
    drag.frame = requestAnimationFrame(() => {
      if (!state.drag) return;
      const current = state.drag;
      current.frame = null;
      call('moveWindowTo', current.targetX, current.targetY).catch(() => {});
    });
  });

  function finishDrag() {
    if (!state.drag) return;
    if (state.drag.frame) cancelAnimationFrame(state.drag.frame);
    state.drag = null;
    document.body.classList.remove('is-dragging');
  }

  document.addEventListener('mouseup', finishDrag);
  window.addEventListener('blur', finishDrag);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) finishDrag();
  });

  document.addEventListener('pointerdown', onDocumentPointerDown);
  document.addEventListener('keydown', onKeyDown);
}

function applyScale() {
  const baseWidth = 392;
  const baseHeight = 330;
  const scale = Math.min(window.innerWidth / baseWidth, window.innerHeight / baseHeight);
  if (!Number.isFinite(scale) || scale <= 0) return;
  document.documentElement.style.setProperty('--ui-scale', String(scale));
}

async function init() {
  bindEvents();
  recordButtonHomes();
  if (elements.cdArt) {
    elements.cdArt.addEventListener('load', () => updateCdContrast(elements.cdArt));
  }
  applyUi(state.ui);
  applyScale();
  window.addEventListener('resize', applyScale);

  for (const sheet of [
    elements.settingsSheet,
    elements.queueSheet,
    elements.searchSheet,
    elements.playlistsSheet,
  ]) {
    sheet.inert = true;
  }

  if (!api) {
    showFatal('The app bridge did not load. Restart Spotify Mini Player.');
    return;
  }

  api.onState((snapshot) => {
    try {
      handleState(snapshot);
    } catch (error) {
      console.error('[renderer] Could not render state:', error);
    }
  });
  api.onUiChanged((ui) => handleUiChanged(ui));
  api.onToast(({ message, kind } = {}) => showToast(message, kind));
  api.onOpenSettings(() => openSettings());
  api.onOpenQueue(() => openQueue());
  api.onOpenSearch(() => handleSearchPill());
  api.onOpenPlaylists(() => openPlaylists());

  state.progressTimer = setInterval(updateProgressDisplay, 500);

  try {
    const [snapshot, settings] = await Promise.all([call('getState'), call('getSettings')]);
    applySettings(settings);
    handleState(snapshot);
  } catch (error) {
    showFatal(error.message);
  }
}

function handleState(snapshot) {
  if (!snapshot) return;

  state.snapshot = snapshot;
  if (snapshot.ui) applyUi(snapshot.ui);

  renderStatus(snapshot);
  renderPlayer(snapshot.playback, snapshot);
  updateQueueCount(snapshot);
  updateSettingsStatus(snapshot);
  maybeShowNoticeToast(snapshot.notice);
  renderInfo();

  if (snapshot.status === 'online' && state.pendingSheet) {
    const pending = state.pendingSheet;
    state.pendingSheet = '';
    if (pending === 'search') openSearchSheet();
    else if (pending === 'playlists') openPlaylists();
    else if (pending === 'queue') openQueue();
  }
}

function setView(view) {
  if (state.currentView === view) return;
  state.currentView = view;
  elements.loadingView.hidden = view !== 'loading';
  elements.unavailableView.hidden = view !== 'unavailable';
  elements.playerView.hidden = view !== 'player';
}

function renderStatus(snapshot) {
  if (snapshot.status === 'starting') {
    setView('loading');
  } else if (snapshot.status === 'cli-missing') {
    setView('unavailable');
  } else {
    setView('player');
  }

  const online = snapshot.status === 'online';
  const offline = snapshot.status === 'offline';
  const actionEnabled = online || offline;

  elements.searchInput.disabled = !online;
  elements.queueButton.disabled = !online;
  elements.playlistsButton.disabled = !online;
  elements.openSearchButton.disabled = !actionEnabled;
  elements.openSearchButton.classList.toggle('is-disabled', !actionEnabled);
  elements.openSearchButton.classList.toggle('is-offline-action', offline);

  if (online) {
    elements.searchPillText.textContent = 'Search songs, albums, artists';
    elements.searchPillKey.textContent = 'Ctrl F';
    elements.searchPillKey.hidden = false;
    elements.openSearchButton.setAttribute('aria-label', 'Search Spotify');
    elements.openSearchButton.title = 'Search Spotify (Ctrl+F)';
  } else if (offline) {
    elements.searchPillText.textContent = 'Spotify is closed · Open Spotify';
    elements.searchPillKey.hidden = true;
    elements.openSearchButton.setAttribute('aria-label', 'Open Spotify');
    elements.openSearchButton.title = 'Open Spotify';
  } else if (snapshot.status === 'starting') {
    elements.searchPillText.textContent = 'Connecting to Spotify…';
    elements.searchPillKey.hidden = true;
    elements.openSearchButton.setAttribute('aria-label', 'Connecting to Spotify');
    elements.openSearchButton.title = 'Connecting to Spotify';
  } else {
    elements.searchPillText.textContent = 'Spotify desktop not found';
    elements.searchPillKey.hidden = true;
    elements.openSearchButton.setAttribute('aria-label', 'Spotify desktop not found');
    elements.openSearchButton.title = 'Spotify desktop not found';
  }

  elements.searchInput.placeholder = online
    ? 'Search songs, albums, artists, playlists'
    : 'Open Spotify to search';
}

function fitCdOrbitText() {
  const textPath = elements.cdOrbitText;
  if (!textPath || !elements.cdStage || elements.cdStage.hidden) return;
  const full = textPath.dataset.fullText || textPath.textContent || '';
  if (!full) return;

  const maxLength = 2 * Math.PI * 108 * 0.92;
  textPath.textContent = full;
  let length = 0;
  try {
    length = textPath.getComputedTextLength();
  } catch {
    return;
  }
  if (length <= maxLength) return;

  let low = 0;
  let high = full.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    textPath.textContent = `${full.slice(0, mid)}…`;
    try {
      if (textPath.getComputedTextLength() <= maxLength) low = mid;
      else high = mid - 1;
    } catch {
      break;
    }
  }
  textPath.textContent = `${full.slice(0, low)}…`;
}

function renderPlayer(playback, snapshot) {
  const online = snapshot?.status === 'online';
  const hasTrack = Boolean(playback);
  const title = playback?.title || (online ? 'Nothing playing' : 'Spotify is closed');
  const artist =
    playback?.artist ||
    (online ? 'Start a track in Spotify' : 'Open the desktop app to connect');

  const trackKey = playback
    ? `${playback.trackId || ''}|${playback.title || ''}|${playback.artist || ''}`
    : '';
  const trackChanged = trackKey !== state.lastTrackKey;

  if (trackChanged && state.lastTrackKey) {
    elements.trackMeta.classList.add('is-changing');
    if (state.metaTimer) clearTimeout(state.metaTimer);
    state.metaTimer = setTimeout(() => {
      state.metaTimer = null;
      elements.trackMeta.classList.remove('is-changing');
    }, 210);
  }

  elements.trackTitle.textContent = title;
  elements.trackArtist.textContent = artist;
  elements.trackTitle.title = playback ? title : '';
  elements.trackArtist.title = playback
    ? [playback.artist, playback.album, playback.device?.name].filter(Boolean).join(' · ')
    : '';

  if (elements.cdTitle) elements.cdTitle.textContent = title;
  if (elements.cdArtist) elements.cdArtist.textContent = artist;
  if (elements.cdOrbitText) {
    const orbitText = `${title} · ${artist}`;
    elements.cdOrbitText.dataset.fullText = orbitText;
    elements.cdOrbitText.textContent = orbitText;
    fitCdOrbitText();
  }
  if (elements.cdDisc) elements.cdDisc.classList.toggle('is-playing', Boolean(playback?.isPlaying));
  if (elements.cdOrbit) elements.cdOrbit.classList.toggle('is-playing', Boolean(playback?.isPlaying));

  updateArtwork(playback?.albumArt || '');
  setAccent(playback?.accent || FALLBACK_ACCENT);

  const canControl = Boolean(hasTrack && online);
  const isPlaying = Boolean(playback?.isPlaying);

  elements.playButton.disabled = !canControl;
  elements.previousButton.disabled = !canControl;
  elements.nextButton.disabled = !canControl;
  elements.playButton.classList.toggle('is-playing', isPlaying);
  elements.playButton.setAttribute('aria-pressed', String(isPlaying));
  elements.playButton.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
  elements.playButton.title = isPlaying ? 'Pause' : 'Play';

  const volume = Number.isFinite(snapshot?.volume)
    ? snapshot.volume
    : playback?.device?.volumePercent;
  const hasVolume = Number.isFinite(volume);

  // Keep the last known volume visible while Spotify is closed, but only
  // allow changing it when the desktop app is reachable.
  elements.volumeSlider.disabled = !online || !hasVolume;
  if (hasVolume && Date.now() > state.volumeHoldUntil) {
    const nextVolume = clamp(Math.round(volume), 0, 100);
    elements.volumeSlider.value = String(nextVolume);
    elements.volumeValue.textContent = String(nextVolume);
    updateRangeFill(elements.volumeSlider);
  } else if (!hasVolume) {
    elements.volumeValue.textContent = '--';
    elements.volumeSlider.style.setProperty('--fill', '0%');
    elements.volumeSlider.closest('.volume-capsule')?.style.setProperty('--vol', '0');
  }

  elements.playerView.classList.toggle('is-empty', !hasTrack);
  elements.emptyState.hidden = hasTrack || state.currentView !== 'player';
  elements.emptySearchButton.disabled = !online;
  elements.emptyTitle.textContent = online ? 'Nothing playing' : 'Spotify is closed';
  elements.emptyText.textContent = online
    ? 'Start a track in Spotify, or search for something new.'
    : 'Open the desktop app to reconnect.';

  syncProgress(playback, snapshot);
  state.lastTrackKey = trackKey;
}

function updateArtwork(url) {
  if (!url) {
    state.artworkUrl = '';
    state.frontArtwork = null;
    elements.backdropA.classList.remove('is-visible');
    elements.backdropB.classList.remove('is-visible');
    elements.app.classList.remove('has-art');
    if (elements.cdArt) elements.cdArt.removeAttribute('src');
    elements.app.dataset.cdContrast = 'dark';
    return;
  }

  if (elements.cdArt && elements.cdArt.src !== url) {
    elements.cdArt.src = url;
  }

  if (url === state.artworkUrl) return;

  const previousFront = state.frontArtwork;
  const next =
    previousFront === elements.backdropA ? elements.backdropB : elements.backdropA;
  const playback = state.snapshot?.playback;

  const reveal = () => {
    if (next.dataset.url !== url) return;
    next.classList.add('is-visible');
    if (previousFront && previousFront !== next) {
      previousFront.classList.remove('is-visible');
    }
    state.frontArtwork = next;
    state.artworkUrl = url;
    elements.app.classList.add('has-art');
  };

  next.onload = reveal;
  next.onerror = () => {
    if (next.dataset.url !== url) return;
    if (!state.frontArtwork) elements.app.classList.remove('has-art');
    state.artworkUrl = '';
  };
  next.dataset.url = url;
  next.alt = playback ? `${playback.title} by ${playback.artist}` : 'Album artwork';
  next.src = url;

  if (next.complete && next.naturalWidth > 0) {
    requestAnimationFrame(reveal);
  }
}

function updateCdContrast(img) {
  if (!img || !img.naturalWidth) {
    elements.app.dataset.cdContrast = 'dark';
    return;
  }
  try {
    const size = 24;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;
    let total = 0;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;
      total += 0.2126 * r + 0.7152 * g + 0.0722 * b;
      count += 1;
    }
    const avg = count ? total / count : 0.5;
    elements.app.dataset.cdContrast = avg > 0.62 ? 'light' : 'dark';
  } catch {
    elements.app.dataset.cdContrast = 'dark';
  }
}

function setAccent(value) {
  const artAccent = isHexColor(value) ? value : FALLBACK_ACCENT;
  state.artAccent = artAccent;

  const themeAccent = isHexColor(state.ui.themePalette?.accent)
    ? state.ui.themePalette.accent
    : '';
  const accent = themeAccent || artAccent;
  if (accent === state.accent) return;
  state.accent = accent;

  document.documentElement.style.setProperty('--accent', accent);
  document.documentElement.style.setProperty(
    '--on-accent',
    relativeLuminance(accent) > 0.38 ? '#06110a' : '#ffffff',
  );
}

function maybeShowNoticeToast(notice) {
  if (!notice) {
    state.lastNoticeKey = '';
    return;
  }

  const key = `${notice.kind}:${notice.message}`;
  if (key === state.lastNoticeKey) return;
  state.lastNoticeKey = key;

  if (notice.kind === 'error') {
    showToast(notice.message, 'error');
  }
}

function updateQueueCount(snapshot = state.snapshot) {
  const count = Math.max(0, Number(snapshot?.queueCount) || 0);
  elements.queueCount.hidden = count === 0;
  elements.queueCount.textContent = count > 99 ? '99+' : String(count);
  elements.queueButton.setAttribute(
    'aria-label',
    count > 0 ? `Open queue, ${count} upcoming` : 'Open queue',
  );
}

function updateSettingsStatus(snapshot = state.snapshot) {
  if (!snapshot) return;

  const status = snapshot.status;
  let text = 'Connecting…';
  let hint =
    'The widget reads the current song directly from the Spotify app on this PC.';
  let dotState = 'connecting';

  if (status === 'online') {
    text = snapshot.playback?.device?.name
      ? `Connected · ${snapshot.playback.device.name}`
      : 'Connected to Spotify';
    dotState = 'online';
    hint =
      'Playback, volume, queue, playlists, and search use the Spotify desktop app on this PC.';
  } else if (status === 'cli-missing') {
    text = 'Spotify desktop not found';
    hint =
      snapshot.notice?.message ||
      'Install or update Spotify for Windows, then reopen the widget.';
    dotState = 'offline';
  } else if (status === 'offline') {
    text = 'Spotify is closed';
    hint = snapshot.notice?.message || 'Open the Spotify desktop app to connect.';
    dotState = 'offline';
  } else if (status === 'starting') {
    text = 'Connecting to Spotify…';
    dotState = 'connecting';
  }

  elements.settingsStatus.textContent = text;
  elements.settingsStatusHint.textContent = hint;
  elements.settingsStatusDot.dataset.state = dotState;

  const cli = snapshot.cli;
  if (cli?.available) {
    elements.cliVersionText.textContent = cli.version
      ? `spotify_cli ${cli.version}`
      : 'Available';
    elements.localControl.title = cli.path || '';
  } else {
    elements.cliVersionText.textContent = 'Unavailable';
    elements.localControl.removeAttribute('title');
  }
}

function applyUi(ui) {
  if (!ui) return;
  state.ui = { ...state.ui, ...ui };

  document.documentElement.dataset.theme = state.ui.theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.material =
    state.ui.material === 'acrylic' || state.ui.material === 'mica'
      ? state.ui.material
      : 'fallback';

  applyThemePalette(state.ui.themePalette);
  applyThemeSkin(state.ui.themePalette?.skin);
  setAccent(state.artAccent);

  elements.demoNote.hidden = !state.ui.demo;
  updateMaterialText();
}

function updateMaterialText() {
  const material = state.ui.material;
  if (material === 'acrylic') {
    elements.materialText.textContent = 'Mica transparent';
    elements.transparencyHint.textContent =
      'Adjusts the glass tint. Mica transparency keeps the desktop visible behind the widget.';
  } else if (material === 'mica') {
    elements.materialText.textContent = 'Windows Mica';
    elements.transparencyHint.textContent =
      'Adjusts the strength of the Mica tint. Saved automatically.';
  } else {
    elements.materialText.textContent = 'Translucent fallback';
    elements.transparencyHint.textContent =
      'Changes the whole widget live and is saved automatically.';
  }
}

function handleUiChanged(ui) {
  applyUi(ui);
  if (state.snapshot) {
    state.snapshot.ui = { ...state.snapshot.ui, ...ui };
  }
}

function applyTransparencyVisual(transparency) {
  const value = clamp(Number(transparency) || 0, 0, 100) / 100;
  // 0% = stronger tint, 100% = let more of the desktop and artwork through.
  document.documentElement.style.setProperty(
    '--glass-tint',
    (0.62 - value * 0.36).toFixed(3),
  );
}

function applySettings(settings) {
  if (!settings) return;
  state.settings = settings;

  if (settings.ui) applyUi(settings.ui);

  if (settings.viewMode) state.viewMode = settings.viewMode;
  if (typeof settings.showSongName === 'boolean') state.showSongName = settings.showSongName;
  applyViewMode(state.viewMode);
  applySongNameVisibility();

  const minOpacity = Number(settings.minOpacity) || 0.55;
  const opacity = clamp(Number(settings.opacity) || 0.92, minOpacity, 1);
  const transparency = Math.round(((1 - opacity) / (1 - minOpacity)) * 100);
  applyTransparencyVisual(transparency);

  if (document.activeElement !== elements.opacitySlider) {
    elements.opacitySlider.value = String(transparency);
  }
  elements.transparencyValue.textContent = `${transparency}%`;
  updateRangeFill(elements.opacitySlider);

  elements.versionText.textContent = settings.version || '1.0.0';
  updateMaterialText();
}

async function loadSettings() {
  const settings = await call('getSettings');
  applySettings(settings);
  return settings;
}

const CONTROL_BUTTON_IDS = [
  'volumeButton',
  'moreButton',
  'previousButton',
  'playButton',
  'nextButton',
  'infoButton',
  'queueButton',
];

const CD_SLOT_MAP = {
  moreButton: 'cdSlotUpperRight',
  infoButton: 'cdSlotUpperLeft',
  volumeButton: 'cdSlotLeft',
  queueButton: 'cdSlotRight',
  previousButton: 'cdSlotLowerLeft',
  playButton: 'cdSlotBottom',
  nextButton: 'cdSlotLowerRight',
};

const buttonHomes = new Map();

function recordButtonHomes() {
  for (const id of CONTROL_BUTTON_IDS) {
    const node = elements[id];
    if (node && !buttonHomes.has(node)) {
      buttonHomes.set(node, { parent: node.parentNode, next: node.nextSibling });
    }
  }
}

function placeControls(mode) {
  const nodes = CONTROL_BUTTON_IDS.map((id) => elements[id]).filter(Boolean);
  if (mode === 'cd') {
    for (const [id, slotId] of Object.entries(CD_SLOT_MAP)) {
      const node = elements[id];
      const slot = elements[slotId];
      if (node && slot && node.parentNode !== slot) slot.append(node);
    }
    return;
  }

  for (const node of nodes) {
    const home = buttonHomes.get(node);
    if (!home || node.parentNode === home.parent) continue;
    if (home.next && home.next.parentNode === home.parent) {
      home.parent.insertBefore(node, home.next);
    } else {
      home.parent.append(node);
    }
  }
}

function applySongNameVisibility() {
  const show = state.showSongName !== false;
  if (elements.trackMeta) elements.trackMeta.hidden = !show;
  if (elements.cdOrbit) elements.cdOrbit.classList.toggle('is-hidden', !show);
  if (elements.songNameToggleButton) {
    elements.songNameToggleButton.setAttribute('aria-pressed', String(show));
    elements.songNameToggleButton.classList.toggle('is-active', show);
  }
}

function applyViewMode(mode) {
  const safe = ['controls', 'default', 'cd'].includes(mode) ? mode : 'default';
  state.viewMode = safe;
  elements.app.dataset.view = safe;

  const isCd = safe === 'cd';
  if (elements.cdStage) {
    elements.cdStage.hidden = !isCd;
    elements.cdStage.setAttribute('aria-hidden', String(!isCd));
  }
  if (isCd) fitCdOrbitText();
  if (elements.playerBottom) elements.playerBottom.hidden = isCd;
  if (elements.songNameToggleButton) elements.songNameToggleButton.hidden = safe !== 'controls';

  if (elements.viewSwitcher) {
    for (const btn of elements.viewSwitcher.querySelectorAll('[data-view]')) {
      btn.classList.toggle('is-active', btn.dataset.view === safe);
    }
  }

  placeControls(safe);
  applySongNameVisibility();
}

async function setWidgetView(mode) {
  if (!['controls', 'default', 'cd'].includes(mode)) return;
  if (mode === state.viewMode) {
    applyViewMode(mode);
    return;
  }
  state.viewMode = mode;
  applyViewMode(mode);
  if (elements.settingsSheet?.classList.contains('is-open')) closeSheet();
  try {
    await call('setViewMode', mode);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function setShowSongName(enabled) {
  state.showSongName = Boolean(enabled);
  applySongNameVisibility();
  try {
    await call('setShowSongName', enabled);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function focusWithoutScroll(target) {
  if (!target || typeof target.focus !== 'function') return;
  try {
    target.focus({ preventScroll: true });
  } catch {
    target.focus();
  }
  if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
}

function openSheet(sheet, focusTarget) {
  if (state.sheet === sheet) {
    const existing = (focusTarget && sheet.querySelector(focusTarget)) || sheet;
    focusWithoutScroll(existing);
    return;
  }

  if (state.sheet) {
    closeSheet({ restore: false, immediate: true });
  }

  state.lastFocusBeforeSheet = document.activeElement;
  state.sheet = sheet;
  elements.content.inert = true;
  sheet.inert = false;
  sheet.setAttribute('aria-hidden', 'false');
  elements.sheetBackdrop.hidden = false;
  updateSheetButtons();

  requestAnimationFrame(() => {
    elements.sheetBackdrop.classList.add('is-visible');
    sheet.classList.add('is-open');
  });

  setTimeout(() => {
    if (state.sheet !== sheet) return;
    const target = (focusTarget && sheet.querySelector(focusTarget)) || sheet;
    focusWithoutScroll(target);
  }, 80);
}

function closeSheet({ restore = true, immediate = false } = {}) {
  let sheet = state.sheet;
  if (!sheet) {
    sheet = document.querySelector('.sheet.is-open');
  }
  if (!sheet) {
    elements.content.inert = false;
    elements.sheetBackdrop.hidden = true;
    elements.sheetBackdrop.classList.remove('is-visible');
    return;
  }
  state.sheet = sheet;

  state.sheet = null;
  elements.sheetBackdrop.classList.remove('is-visible');
  sheet.classList.remove('is-open');
  sheet.setAttribute('aria-hidden', 'true');
  elements.content.inert = false;
  updateSheetButtons();

  const finish = () => {
    if (state.sheet) return;
    sheet.inert = true;
    elements.sheetBackdrop.hidden = true;
  };

  if (immediate) finish();
  else setTimeout(finish, 300);

  if (!restore) return;

  const target = state.lastFocusBeforeSheet;
  if (
    target &&
    typeof target.focus === 'function' &&
    target.isConnected &&
    target !== document.body
  ) {
    focusWithoutScroll(target);
  } else if (sheet === elements.queueSheet) {
    focusWithoutScroll(elements.queueButton);
  } else if (sheet === elements.playlistsSheet) {
    focusWithoutScroll(elements.playlistsButton);
  } else if (sheet === elements.searchSheet) {
    focusWithoutScroll(elements.openSearchButton);
  } else {
    focusWithoutScroll(elements.settingsButton);
  }
}

function updateSheetButtons() {
  elements.settingsButton.setAttribute(
    'aria-expanded',
    String(state.sheet === elements.settingsSheet),
  );
  elements.queueButton.setAttribute(
    'aria-expanded',
    String(state.sheet === elements.queueSheet),
  );
  elements.playlistsButton.setAttribute(
    'aria-expanded',
    String(state.sheet === elements.playlistsSheet),
  );
}

function openSettings() {
  closePopovers();
  openSheet(elements.settingsSheet);
  loadSettings().catch((error) => showToast(error.message, 'error'));
}

function closeSettings() {
  if (state.sheet === elements.settingsSheet) closeSheet();
}

/* ------------------------------------------------------------------ */
/* Search                                                             */
/* ------------------------------------------------------------------ */

function handleSearchPill() {
  const status = state.snapshot?.status;

  if (status === 'offline') {
    // With retained playback the empty-state button is hidden, so the topbar
    // pill doubles as the persistent way to launch Spotify again.
    openSpotify();
    return;
  }

  if (status === 'starting') {
    state.pendingSheet = 'search';
    return;
  }

  if (status === 'cli-missing') return;
  openSearchSheet();
}

function openSearchSheet() {
  if (state.snapshot?.status === 'starting') {
    state.pendingSheet = 'search';
    return;
  }
  if (state.snapshot && state.snapshot.status !== 'online') {
    showToast('Open Spotify to search.', 'error');
    return;
  }

  closePopovers();
  openSheet(elements.searchSheet, '#searchInput');

  const preset = state.ui.searchQuery;
  if (preset && !elements.searchInput.value) {
    elements.searchInput.value = preset;
    state.ui.searchQuery = '';
    onSearchInput();
  } else if (!elements.searchInput.value) {
    renderSearchResults();
  }
}

function closeSearch() {
  if (state.sheet === elements.searchSheet) closeSheet();
}

function clearSearch() {
  elements.searchInput.value = '';
  onSearchInput();
  focusWithoutScroll(elements.searchInput);
}

function onSearchInput() {
  const query = elements.searchInput.value.trim();
  state.searchQuery = query;
  elements.clearSearchButton.hidden = query.length === 0;

  if (state.searchTimer) {
    clearTimeout(state.searchTimer);
    state.searchTimer = null;
  }

  state.searchSeq += 1;
  state.searchResults = [];
  state.searchError = '';

  if (!query) {
    state.searchLoading = false;
    renderSearchResults();
    return;
  }

  state.searchLoading = true;
  renderSearchResults();

  const seq = state.searchSeq;
  state.searchTimer = setTimeout(() => {
    state.searchTimer = null;
    runSearch(query, state.searchType, seq);
  }, 260);
}

function onFilterClick(event) {
  const chip = event.target.closest('.filter-chip');
  if (!chip) return;

  const type = chip.dataset.type;
  if (!type || type === state.searchType) return;

  state.searchType = type;
  for (const node of elements.searchFilters.querySelectorAll('.filter-chip')) {
    const active = node === chip;
    node.classList.toggle('is-active', active);
    node.setAttribute('aria-selected', String(active));
  }

  state.searchSeq += 1;
  state.searchResults = [];
  state.searchError = '';

  if (state.searchQuery) {
    state.searchLoading = true;
    renderSearchResults();
    const seq = state.searchSeq;
    runSearch(state.searchQuery, type, seq);
  } else {
    renderSearchResults();
  }
}

async function runSearch(query, type, seq) {
  try {
    const results = await call('search', query, type);
    if (seq !== state.searchSeq || query !== state.searchQuery || type !== state.searchType) {
      return;
    }
    state.searchResults = results;
    state.searchError = '';
  } catch (error) {
    if (seq !== state.searchSeq || query !== state.searchQuery) return;
    state.searchResults = [];
    state.searchError = error.message;
  } finally {
    if (seq === state.searchSeq && query === state.searchQuery) {
      state.searchLoading = false;
      renderSearchResults();
    }
  }
}

function searchTypeLabel(type) {
  return { track: 'Song', album: 'Album', artist: 'Artist', playlist: 'Playlist' }[type] || 'Song';
}

function renderSearchResults() {
  if (state.sheet !== elements.searchSheet) return;

  elements.searchResults.replaceChildren();
  elements.searchStatus.hidden = true;
  elements.searchStatus.textContent = '';

  if (state.searchLoading) {
    elements.searchStatus.hidden = false;
    elements.searchStatus.textContent = 'Searching Spotify…';
    return;
  }

  if (state.searchError) {
    elements.searchStatus.hidden = false;
    elements.searchStatus.textContent = state.searchError;
    return;
  }

  if (!state.searchQuery) {
    elements.searchStatus.hidden = false;
    elements.searchStatus.textContent =
      'Search songs, albums, artists, and playlists. Press Enter to play the first result.';
    return;
  }

  if (state.searchResults.length === 0) {
    elements.searchStatus.hidden = false;
    elements.searchStatus.textContent =
      `No ${searchTypeLabel(state.searchType).toLowerCase()}s found for “${state.searchQuery}”.`;
    return;
  }

  for (const result of state.searchResults) {
    const row = document.createElement('div');
    row.className = 'track-row';
    row.setAttribute('role', 'listitem');

    const main = document.createElement('button');
    main.className = 'track-row-main';
    main.type = 'button';
    main.title = `Play ${result.title}`;
    main.dataset.uri = result.uri;
    main.dataset.kind = result.kind || state.searchType;
    main.append(
      createThumb(result.albumArt, 'row-art'),
      createRowMeta(result.title, result.artist || searchTypeLabel(result.kind)),
    );

    if (result.kind !== 'track') {
      const kind = document.createElement('span');
      kind.className = 'row-kind';
      kind.textContent = searchTypeLabel(result.kind);
      main.append(kind);
    }

    row.append(main);

    if (result.kind === 'track') {
      const add = document.createElement('button');
      add.className = 'row-action';
      add.type = 'button';
      add.title = `Add ${result.title} to queue`;
      add.setAttribute('aria-label', `Add ${result.title} to queue`);
      add.dataset.action = 'queue';
      add.dataset.uri = result.uri;
      add.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
      row.append(add);
    }

    elements.searchResults.append(row);
  }
}

function onSearchKeyDown(event) {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeSearch();
    return;
  }

  if (event.key === 'Enter') {
    const first = state.searchResults[0];
    if (first && !state.searchLoading) {
      event.preventDefault();
      playResult(first);
    }
  }
}

function onResultListClick(event) {
  const action = event.target.closest('[data-action="queue"]');
  if (action) {
    const result = state.searchResults.find((item) => item.uri === action.dataset.uri);
    if (result) addResultToQueue(result, action);
    return;
  }

  const main = event.target.closest('.track-row-main');
  if (!main) return;
  const result = state.searchResults.find((item) => item.uri === main.dataset.uri);
  if (result) playResult(result);
}

async function playResult(result) {
  try {
    await call('playUri', result.uri);
    closeSheet();
    showToast(`Playing ${result.title}.`, 'info');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function addResultToQueue(result, button) {
  button.disabled = true;
  try {
    await call('addToQueue', result.uri);
    showToast(`Added ${result.title} to the queue.`, 'info');
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    button.disabled = false;
  }
}

/* ------------------------------------------------------------------ */
/* Queue                                                              */
/* ------------------------------------------------------------------ */

function openQueue() {
  if (state.snapshot?.status === 'starting') {
    state.pendingSheet = 'queue';
    return;
  }

  closePopovers();
  openSheet(elements.queueSheet);
  refreshQueue({ force: true });
}

function closeQueue() {
  if (state.sheet === elements.queueSheet) closeSheet();
}

async function refreshQueue({ force = false } = {}) {
  if (state.queueLoading) return;
  state.queueLoading = true;
  state.queueError = '';
  renderQueue();

  try {
    const queue = await call('getQueue', { force, enrich: true });
    state.queue = queue;
  } catch (error) {
    state.queueError = error.message;
  } finally {
    state.queueLoading = false;
    renderQueue();
  }
}

function renderQueue() {
  const snapshot = state.snapshot;
  const current = snapshot?.playback;
  const upcoming = state.queue?.upcoming || [];

  elements.queueSubtitle.textContent =
    upcoming.length > 0
      ? `${upcoming.length} ${upcoming.length === 1 ? 'song' : 'songs'} up next`
      : 'Up next';

  elements.queueNow.replaceChildren();
  if (current) {
    const row = document.createElement('div');
    row.className = 'queue-now-row';

    const thumb = createThumb(current.albumArt, 'queue-now-art');
    const meta = document.createElement('div');
    meta.className = 'row-meta';
    const title = document.createElement('span');
    title.className = 'row-title';
    title.textContent = current.title;
    const artist = document.createElement('span');
    artist.className = 'row-artist';
    artist.textContent = current.artist;
    meta.append(title, artist);

    const stateLabel = document.createElement('span');
    stateLabel.className = 'queue-now-state';
    stateLabel.textContent = current.isPlaying ? 'Playing' : 'Paused';

    row.append(thumb, meta, stateLabel);
    elements.queueNow.append(row);
  } else {
    const empty = document.createElement('p');
    empty.className = 'queue-now-empty';
    empty.textContent =
      snapshot?.status === 'online' ? 'Nothing playing' : 'Spotify is not connected';
    elements.queueNow.append(empty);
  }

  elements.queueList.replaceChildren();
  elements.queueEmpty.hidden = true;
  elements.queueRetryButton.hidden = true;

  if (state.queueLoading) {
    elements.queueEmpty.hidden = false;
    elements.queueEmptyText.textContent = 'Loading queue…';
    return;
  }

  if (state.queueError) {
    elements.queueEmpty.hidden = false;
    elements.queueEmptyText.textContent = state.queueError;
    elements.queueRetryButton.hidden = false;
    return;
  }

  if (upcoming.length === 0) {
    elements.queueEmpty.hidden = false;
    elements.queueEmptyText.textContent =
      snapshot?.status === 'online' ? 'The queue is empty.' : 'Open Spotify to see the queue.';
    return;
  }

  upcoming.forEach((track, index) => {
    const row = document.createElement('div');
    row.className = 'track-row';
    row.setAttribute('role', 'listitem');

    const main = document.createElement('button');
    main.className = 'track-row-main';
    main.type = 'button';
    main.title = `Play ${track.title}`;
    main.append(
      createThumb(track.albumArt, 'row-art'),
      createRowMeta(track.title, track.artist),
    );
    main.addEventListener('click', () => playQueueItem(track));

    const remove = document.createElement('button');
    remove.className = 'row-action';
    remove.type = 'button';
    remove.title = `Remove ${track.title} from queue`;
    remove.setAttribute('aria-label', `Remove ${track.title} from queue`);
    remove.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"/></svg>';
    remove.addEventListener('click', () => removeQueueItem(index, remove));

    row.append(main, remove);
    elements.queueList.append(row);
  });
}

async function playQueueItem(track) {
  try {
    await call('playUri', track.uri);
    closeSheet();
    showToast(`Playing ${track.title}.`, 'info');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function removeQueueItem(index, button) {
  button.disabled = true;
  try {
    const queue = await call('removeFromQueue', index);
    state.queue = queue;
    renderQueue();
  } catch (error) {
    showToast(error.message, 'error');
    button.disabled = false;
  }
}

/* ------------------------------------------------------------------ */
/* Playlists                                                          */
/* ------------------------------------------------------------------ */

function openPlaylists() {
  if (state.snapshot?.status === 'starting') {
    state.pendingSheet = 'playlists';
    return;
  }
  if (state.snapshot && state.snapshot.status !== 'online') {
    showToast('Open Spotify to browse playlists.', 'error');
    return;
  }

  closePopovers();
  backToPlaylists({ keepSheet: true });
  openSheet(elements.playlistsSheet);
  const preset = state.ui.playlistUri;
  state.ui.playlistUri = '';
  loadPlaylists();
  if (preset) openPlaylistDetail(preset);
}

function closePlaylists() {
  if (state.sheet !== elements.playlistsSheet) return;
  if (state.playlistUri) {
    backToPlaylists();
    return;
  }
  closeSheet();
}

function backToPlaylists({ keepSheet = false } = {}) {
  state.playlistUri = '';
  state.playlistDetail = null;
  state.playlistError = '';
  elements.playlistDetail.hidden = true;
  elements.playlistsList.hidden = false;
  elements.playlistsTitle.textContent = 'Your playlists';
  elements.playlistsSubtitle.textContent = 'Saved in your library';
  elements.refreshPlaylistsButton.hidden = false;
  elements.playlistsStatus.hidden = true;
  if (!keepSheet) focusWithoutScroll(elements.closePlaylistsButton);
}

async function loadPlaylists({ force = false } = {}) {
  if (state.playlistsLoading) return;
  state.playlistsLoading = true;
  state.playlistsError = '';
  renderPlaylists();

  try {
    const result = await call('getPlaylists', { force });
    state.playlists = result.playlists || [];
  } catch (error) {
    state.playlistsError = error.message;
  } finally {
    state.playlistsLoading = false;
    renderPlaylists();
  }
}

function renderPlaylists() {
  if (state.sheet !== elements.playlistsSheet || state.playlistUri) return;

  elements.playlistsList.replaceChildren();
  elements.playlistsStatus.hidden = true;

  if (state.playlistsLoading) {
    elements.playlistsStatus.hidden = false;
    elements.playlistsStatus.textContent = 'Loading your playlists…';
    return;
  }

  if (state.playlistsError) {
    elements.playlistsStatus.hidden = false;
    elements.playlistsStatus.textContent = state.playlistsError;
    return;
  }

  const playlists = state.playlists || [];
  if (playlists.length === 0) {
    elements.playlistsStatus.hidden = false;
    elements.playlistsStatus.textContent = 'No saved playlists found in your library.';
    return;
  }

  elements.playlistsSubtitle.textContent = `${playlists.length} ${
    playlists.length === 1 ? 'playlist' : 'playlists'
  } in your library`;

  for (const playlist of playlists) {
    const row = document.createElement('div');
    row.className = 'playlist-row';
    row.setAttribute('role', 'listitem');

    const main = document.createElement('button');
    main.className = 'playlist-row-main';
    main.type = 'button';
    main.dataset.uri = playlist.uri;
    main.title = `Open ${playlist.name}`;
    main.append(
      createThumb(playlist.image, 'playlist-row-art'),
      createRowMeta(playlist.name, 'Playlist'),
    );

    const chevron = document.createElement('span');
    chevron.className = 'row-chevron';
    chevron.setAttribute('aria-hidden', 'true');
    chevron.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m9 5 7 7-7 7"/></svg>';

    row.append(main, chevron);
    elements.playlistsList.append(row);
  }
}

function onPlaylistsListClick(event) {
  const main = event.target.closest('.playlist-row-main');
  if (!main) return;
  openPlaylistDetail(main.dataset.uri);
}

async function openPlaylistDetail(uri) {
  if (!uri) return;

  state.playlistUri = uri;
  state.playlistDetail = null;
  state.playlistError = '';
  elements.playlistsList.hidden = true;
  elements.playlistDetail.hidden = false;
  elements.playlistsTitle.textContent = 'Playlist';
  elements.playlistsSubtitle.textContent = 'Loading…';
  elements.refreshPlaylistsButton.hidden = true;
  elements.playlistsStatus.hidden = true;
  renderPlaylistDetail();

  try {
    const detail = await call('getPlaylist', uri, { force: false });
    if (state.playlistUri !== uri) return;
    state.playlistDetail = detail;
  } catch (error) {
    if (state.playlistUri !== uri) return;
    state.playlistError = error.message;
  } finally {
    if (state.playlistUri === uri) renderPlaylistDetail();
  }
}

function renderPlaylistDetail() {
  if (!state.playlistUri) return;

  const detail = state.playlistDetail;
  const name = detail?.name || 'Playlist';
  elements.playlistsTitle.textContent = name;
  elements.playlistsSubtitle.textContent = detail
    ? `${detail.trackCount || detail.tracks?.length || 0} songs`
    : 'Loading…';

  if (detail?.image) {
    elements.playlistDetailImage.src = detail.image;
    elements.playlistDetailImage.style.visibility = 'visible';
  } else {
    elements.playlistDetailImage.removeAttribute('src');
    elements.playlistDetailImage.style.visibility = 'hidden';
  }

  elements.playlistDetailName.textContent = name;
  elements.playlistDetailMeta.textContent = detail
    ? `${detail.trackCount || detail.tracks?.length || 0} songs`
    : 'Loading…';
  elements.playPlaylistButton.disabled = !detail || !detail.tracks?.length;

  elements.playlistTracks.replaceChildren();
  elements.playlistsStatus.hidden = true;

  if (state.playlistError) {
    elements.playlistsStatus.hidden = false;
    elements.playlistsStatus.textContent = state.playlistError;
    return;
  }

  if (!detail) {
    elements.playlistsStatus.hidden = false;
    elements.playlistsStatus.textContent = 'Loading playlist…';
    return;
  }

  if (!detail.tracks?.length) {
    elements.playlistsStatus.hidden = false;
    elements.playlistsStatus.textContent = 'This playlist is empty.';
    return;
  }

  for (const track of detail.tracks) {
    const row = document.createElement('div');
    row.className = 'track-row';
    row.setAttribute('role', 'listitem');

    const main = document.createElement('button');
    main.className = 'track-row-main';
    main.type = 'button';
    main.title = `Play ${track.title}`;
    main.dataset.uri = track.uri;
    main.append(
      createThumb(track.albumArt, 'row-art'),
      createRowMeta(track.title, track.artist),
    );

    const add = document.createElement('button');
    add.className = 'row-action';
    add.type = 'button';
    add.title = `Add ${track.title} to queue`;
    add.setAttribute('aria-label', `Add ${track.title} to queue`);
    add.dataset.action = 'queue';
    add.dataset.uri = track.uri;
    add.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';

    row.append(main, add);
    elements.playlistTracks.append(row);
  }
}

function onPlaylistTracksClick(event) {
  const action = event.target.closest('[data-action="queue"]');
  if (action) {
    const track = state.playlistDetail?.tracks?.find(
      (item) => item.uri === action.dataset.uri,
    );
    if (track) addPlaylistTrackToQueue(track, action);
    return;
  }

  const main = event.target.closest('.track-row-main');
  if (!main) return;
  playPlaylistTrack(main.dataset.uri);
}

async function playPlaylist() {
  const detail = state.playlistDetail;
  if (!detail) return;

  try {
    await call('playUri', detail.uri);
    closeSheet();
    showToast(`Playing ${detail.name}.`, 'info');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function playPlaylistTrack(uri) {
  if (!uri) return;
  try {
    await call('playUri', uri);
    closeSheet();
    showToast('Playing track.', 'info');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function addPlaylistTrackToQueue(track, button) {
  button.disabled = true;
  try {
    await call('addToQueue', track.uri);
    showToast(`Added ${track.title} to the queue.`, 'info');
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    button.disabled = false;
  }
}

/* ------------------------------------------------------------------ */
/* Rows                                                               */
/* ------------------------------------------------------------------ */

function createRowMeta(title, artist) {
  const meta = document.createElement('div');
  meta.className = 'row-meta';

  const titleNode = document.createElement('span');
  titleNode.className = 'row-title';
  titleNode.textContent = title || 'Unknown track';

  const artistNode = document.createElement('span');
  artistNode.className = 'row-artist';
  artistNode.textContent = artist || '';

  meta.append(titleNode, artistNode);
  return meta;
}

function createThumbPlaceholder(className) {
  const placeholder = document.createElement('span');
  placeholder.className = `${className} row-art-placeholder`;
  placeholder.setAttribute('aria-hidden', 'true');
  placeholder.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/></svg>';
  return placeholder;
}

function createThumb(url, className) {
  if (!url) return createThumbPlaceholder(className);

  const image = document.createElement('img');
  image.className = className;
  image.src = url;
  image.alt = '';
  image.draggable = false;
  image.addEventListener(
    'error',
    () => image.replaceWith(createThumbPlaceholder(className)),
    { once: true },
  );
  return image;
}

/* ------------------------------------------------------------------ */
/* Popovers                                                           */
/* ------------------------------------------------------------------ */

function togglePopover(name) {
  if (state.popover === name) {
    closePopovers();
    return;
  }
  openPopover(name);
}

function openPopover(name) {
  closePopovers();
  state.popover = name;

  const map = {
    volume: elements.volumePopover,
    more: elements.moreMenu,
    info: elements.infoPopover,
  };
  const popover = map[name];
  if (!popover) return;

  popover.hidden = false;
  elements.volumeButton.setAttribute('aria-expanded', String(name === 'volume'));
  elements.moreButton.setAttribute('aria-expanded', String(name === 'more'));
  elements.infoButton.setAttribute('aria-expanded', String(name === 'info'));

  if (name === 'volume') {
    const volume = Number(state.snapshot?.volume);
    if (Number.isFinite(volume)) {
      elements.volumeSlider.value = String(clamp(Math.round(volume), 0, 100));
      updateRangeFill(elements.volumeSlider);
    }
  }
}

function cancelVolumeClose() {
  if (state.volumeCloseTimer) {
    clearTimeout(state.volumeCloseTimer);
    state.volumeCloseTimer = null;
  }
}

function scheduleVolumeClose() {
  cancelVolumeClose();
  state.volumeCloseTimer = setTimeout(() => {
    state.volumeCloseTimer = null;
    if (state.popover === 'volume') closePopovers();
  }, 220);
}

function closePopovers() {
  cancelVolumeClose();
  state.volumeHoverOpened = false;
  state.popover = null;
  elements.volumePopover.hidden = true;
  elements.moreMenu.hidden = true;
  elements.infoPopover.hidden = true;
  elements.volumeButton.setAttribute('aria-expanded', 'false');
  elements.moreButton.setAttribute('aria-expanded', 'false');
  elements.infoButton.setAttribute('aria-expanded', 'false');
}

function onDocumentPointerDown(event) {
  if (!state.popover) return;
  if (
    elements.volumePopover.contains(event.target) ||
    elements.moreMenu.contains(event.target) ||
    elements.infoPopover.contains(event.target) ||
    elements.volumeButton.contains(event.target) ||
    elements.moreButton.contains(event.target) ||
    elements.infoButton.contains(event.target)
  ) {
    return;
  }
  closePopovers();
}

function renderInfo() {
  const playback = state.snapshot?.playback;
  elements.infoAlbum.textContent = playback?.album || '—';
  elements.infoDevice.textContent = playback?.device?.name || '—';
  elements.infoContext.textContent = playback?.context || (playback ? 'Spotify' : '—');
  const count = Math.max(0, Number(state.snapshot?.queueCount) || 0);
  elements.infoQueue.textContent = count > 0 ? `${count} songs` : 'Nothing queued';
}

/* ------------------------------------------------------------------ */
/* Playback                                                           */
/* ------------------------------------------------------------------ */

async function togglePlayback() {
  if (!state.snapshot?.playback) return;
  try {
    await call('togglePlayback');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function skipNext() {
  if (!state.snapshot?.playback) return;
  try {
    await call('next');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function skipPrevious() {
  if (!state.snapshot?.playback) return;
  try {
    await call('previous');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function refreshPlayback() {
  elements.emptyRefresh.disabled = true;
  try {
    await call('refresh');
    showToast('Spotify refreshed.', 'info');
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    elements.emptyRefresh.disabled = false;
  }
}

async function retrySetup() {
  try {
    await call('refresh');
    showToast('Checked for Spotify.', 'info');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function openSpotify() {
  try {
    await call('openSpotify');
    showToast('Opening Spotify…', 'info');
    setTimeout(() => {
      call('refresh').catch(() => {});
    }, 1400);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function openSpotifyDownload() {
  try {
    await call('openSpotifyDownload');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function hideWidget() {
  closeSheet({ restore: false, immediate: true });
  call('hideWindow').catch((error) => showToast(error.message, 'error'));
}

/* ------------------------------------------------------------------ */
/* Progress                                                           */
/* ------------------------------------------------------------------ */

function syncProgress(playback, snapshot) {
  const now = Date.now();
  const duration = Number(playback?.durationMs) || 0;
  const position = Number(playback?.positionMs) || 0;
  const trackId = playback?.trackId || '';

  if (!playback) {
    state.progress = {
      trackId: '',
      positionMs: 0,
      durationMs: 0,
      at: now,
      playing: false,
      dragging: false,
    };
    updateProgressDisplay();
    return;
  }

  if (state.progress.trackId !== trackId) {
    state.progress = {
      trackId,
      positionMs: position,
      durationMs: duration,
      at: now,
      playing: Boolean(playback.isPlaying),
      dragging: false,
    };
  } else {
    const projected = currentProgressMs(now);
    if (
      Math.abs(projected - position) > 2000 ||
      !playback.isPlaying ||
      !state.progress.playing
    ) {
      state.progress.positionMs = position;
      state.progress.at = now;
    }
    state.progress.durationMs = duration || state.progress.durationMs;
    state.progress.playing = Boolean(playback.isPlaying);
  }

  updateProgressDisplay();
}

function currentProgressMs(now = Date.now()) {
  const progress = state.progress;
  if (progress.dragging) return progress.positionMs;
  let position = progress.positionMs;
  if (progress.playing && progress.at) {
    position += now - progress.at;
  }
  return progress.durationMs > 0
    ? clamp(position, 0, progress.durationMs)
    : Math.max(0, position);
}

function updateProgressDisplay() {
  const progress = state.progress;
  const playback = state.snapshot?.playback;
  const position = currentProgressMs();
  const duration = progress.durationMs;
  const online = state.snapshot?.status === 'online';

  elements.progressSlider.max = String(Math.max(1, duration));
  elements.progressSlider.disabled = !playback || duration <= 0 || !online;

  if (!progress.dragging) {
    elements.progressSlider.value = String(Math.round(position));
  }
  updateRangeFill(elements.progressSlider);

  elements.elapsedTime.textContent = formatTime(position);
  elements.remainingTime.textContent = duration > 0
    ? `-${formatTime(Math.max(0, duration - position))}`
    : '-0:00';
}

function formatTime(ms) {
  const total = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function onProgressInput() {
  const playback = state.snapshot?.playback;
  if (!playback || state.progress.durationMs <= 0) return;

  state.progress.dragging = true;
  state.progress.positionMs = clamp(
    Number(elements.progressSlider.value),
    0,
    state.progress.durationMs,
  );
  updateRangeFill(elements.progressSlider);
  elements.elapsedTime.textContent = formatTime(state.progress.positionMs);
  elements.remainingTime.textContent =
    `-${formatTime(Math.max(0, state.progress.durationMs - state.progress.positionMs))}`;
}

async function onProgressChange() {
  const playback = state.snapshot?.playback;
  if (!playback) return;

  const position = clamp(
    Number(elements.progressSlider.value),
    0,
    state.progress.durationMs || 0,
  );
  state.progress.dragging = false;
  state.progress.positionMs = position;
  state.progress.at = Date.now();
  updateProgressDisplay();

  try {
    await call('seek', Math.round(position));
  } catch (error) {
    showToast(error.message, 'error');
  }
}

/* ------------------------------------------------------------------ */
/* Volume                                                             */
/* ------------------------------------------------------------------ */

function onVolumeInput() {
  if (elements.volumeSlider.disabled) return;
  const volume = clamp(Math.round(Number(elements.volumeSlider.value)), 0, 100);

  elements.volumeValue.textContent = String(volume);
  updateRangeFill(elements.volumeSlider);
  state.pendingVolume = volume;
  state.volumeHoldUntil = Date.now() + 1600;

  if (state.volumeTimer) clearTimeout(state.volumeTimer);
  state.volumeTimer = setTimeout(() => {
    state.volumeTimer = null;
    flushVolume();
  }, 160);
}

async function flushVolume() {
  if (state.volumeTimer) {
    clearTimeout(state.volumeTimer);
    state.volumeTimer = null;
  }

  const volume = state.pendingVolume;
  state.pendingVolume = null;
  if (volume === null || volume === undefined || volume === state.lastVolumeSent) return;

  state.lastVolumeSent = volume;

  try {
    await call('setVolume', volume);
  } catch (error) {
    state.lastVolumeSent = null;
    state.volumeHoldUntil = 0;
    showToast(error.message, 'error');
  }
}

/* ------------------------------------------------------------------ */
/* Settings transparency                                              */
/* ------------------------------------------------------------------ */

function onOpacityInput() {
  const transparency = clamp(Math.round(Number(elements.opacitySlider.value)), 0, 100);
  const minOpacity = Number(state.settings?.minOpacity) || 0.55;
  const opacity = 1 - (transparency / 100) * (1 - minOpacity);

  elements.transparencyValue.textContent = `${transparency}%`;
  updateRangeFill(elements.opacitySlider);
  applyTransparencyVisual(transparency);
  state.pendingOpacity = opacity;

  if (state.opacityTimer) clearTimeout(state.opacityTimer);
  state.opacityTimer = setTimeout(() => {
    state.opacityTimer = null;
    flushOpacity();
  }, 55);
}

async function flushOpacity() {
  if (state.opacityTimer) {
    clearTimeout(state.opacityTimer);
    state.opacityTimer = null;
  }

  const opacity = state.pendingOpacity;
  state.pendingOpacity = null;
  if (opacity === null || opacity === undefined) return;

  try {
    await call('setOpacity', opacity);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function updateRangeFill(input) {
  const min = Number(input.min) || 0;
  const max = Number(input.max) || 100;
  const value = Number(input.value) || 0;
  const percent = clamp(((value - min) / Math.max(1, max - min)) * 100, 0, 100);
  input.style.setProperty('--fill', `${percent}%`);
  const capsule = input.closest('.volume-capsule');
  if (capsule) capsule.style.setProperty('--vol', String(percent / 100));
}

/* ------------------------------------------------------------------ */
/* Keyboard and toast                                                 */
/* ------------------------------------------------------------------ */

function onKeyDown(event) {
  if (event.key === 'Escape') {
    if (state.popover) {
      event.preventDefault();
      closePopovers();
      return;
    }
    if (state.sheet) {
      event.preventDefault();
      closeSheet();
      return;
    }
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
    event.preventDefault();
    if (state.snapshot?.status === 'online') {
      closeSheet({ restore: false, immediate: true });
      openSearchSheet();
      focusWithoutScroll(elements.searchInput);
      elements.searchInput.select();
    } else {
      handleSearchPill();
    }
    return;
  }

  if ((event.ctrlKey || event.metaKey) && event.key === ',') {
    event.preventDefault();
    openSettings();
    return;
  }

  if (event.key === 'Tab' && state.sheet) {
    trapSheetFocus(event);
    return;
  }

  if (
    event.code === 'Space' &&
    state.currentView === 'player' &&
    !state.sheet &&
    !state.popover &&
    !isEditableTarget(event.target) &&
    document.activeElement === document.body
  ) {
    event.preventDefault();
    togglePlayback();
  }
}

function trapSheetFocus(event) {
  const sheet = state.sheet;
  if (!sheet) return;

  const focusable = Array.from(
    sheet.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((node) => node.offsetParent !== null);

  if (!focusable.length) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;
  const outside = !sheet.contains(active);
  const atStart = active === first || active === sheet || outside;

  if (event.shiftKey) {
    if (atStart) {
      event.preventDefault();
      focusWithoutScroll(last);
    }
  } else if (active === last || outside) {
    event.preventDefault();
    focusWithoutScroll(first);
  }
}

function isEditableTarget(target) {
  return Boolean(
    target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable),
  );
}

function showToast(message, kind = 'info') {
  if (!message) return;

  if (state.toastTimer) {
    clearTimeout(state.toastTimer);
    state.toastTimer = null;
  }
  if (state.toastHideTimer) {
    clearTimeout(state.toastHideTimer);
    state.toastHideTimer = null;
  }

  elements.toastText.textContent = message;
  elements.toast.dataset.kind = kind;
  elements.toast.hidden = false;

  requestAnimationFrame(() => {
    elements.toast.classList.add('is-visible');
  });

  state.toastTimer = setTimeout(() => {
    state.toastTimer = null;
    elements.toast.classList.remove('is-visible');
    state.toastHideTimer = setTimeout(() => {
      state.toastHideTimer = null;
      elements.toast.hidden = true;
    }, 220);
  }, 4200);
}

function showFatal(message) {
  setView('loading');
  const paragraph = elements.loadingView.querySelector('p');
  if (paragraph) paragraph.textContent = message || 'Spotify Mini Player could not start.';
}

init();
