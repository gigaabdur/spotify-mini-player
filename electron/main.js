'use strict';

const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  ipcMain,
  shell,
  nativeImage,
  nativeTheme,
  screen,
  desktopCapturer,
  session,
} = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { APP_NAME, APP_ID, WINDOW } = require('./lib/constants');
const { ConfigStore } = require('./lib/config-store');
const { SpotifyService } = require('./lib/spotify-service');
const { DemoService } = require('./lib/demo-service');
const { createMediaPositionReader } = require('./lib/media-position');
const { createSpotifyThemeReader } = require('./lib/spotify-theme');
const { AppError, toPublicError } = require('./lib/errors');

const DEMO_OFFLINE = process.argv.includes('--demo-offline') ||
  process.argv.includes('--demo-logged-out');
const DEMO = process.argv.includes('--demo') || DEMO_OFFLINE;
const DEMO_EMPTY = process.argv.includes('--demo-empty');
const SCREENSHOT = process.argv.includes('--screenshot');
const OPEN_SETTINGS_ON_START = process.argv.includes('--open-settings');
const OPEN_QUEUE_ON_START = process.argv.includes('--open-queue');
const OPEN_SEARCH_ON_START = process.argv.includes('--open-search');
const OPEN_PLAYLISTS_ON_START = process.argv.includes('--open-playlists');
const PLAYLIST_URI = (process.argv.find((arg) => arg.startsWith('--playlist-uri=')) || '')
  .slice('--playlist-uri='.length);
const SEARCH_QUERY = (process.argv.find((arg) => arg.startsWith('--search-query=')) || '')
  .slice('--search-query='.length);
const FORCE_THEME = process.argv.includes('--light')
  ? 'light'
  : process.argv.includes('--dark')
    ? 'dark'
    : null;
const IS_WINDOWS = process.platform === 'win32';

app.setName(APP_NAME);
app.setAppUserModelId(APP_ID);

const ROOT_DIR = path.join(__dirname, '..');
const USER_DATA_DIR = app.getPath('userData');
const SCREENSHOT_PATH = process.env.SMP_SCREENSHOT_PATH
  ? path.resolve(process.env.SMP_SCREENSHOT_PATH)
  : path.join(ROOT_DIR, 'docs', 'preview.png');
const SCREENSHOT_DELAY = Math.max(1000, Number(process.env.SMP_SCREENSHOT_DELAY) || 3000);

const config = new ConfigStore(path.join(USER_DATA_DIR, 'config.json'));

let mainWindow = null;
let tray = null;
let service = null;
let mediaPositionReader = null;
let themeReader = null;
let spotifyTheme = null;
let themeTimer = null;
let lastThemeSignature = '';
let isQuitting = false;
let materialState = 'fallback';
let boundsSaveTimer = null;
let lastTraySignature = '';
let screenshotStarted = false;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function windowsBuildNumber() {
  if (!IS_WINDOWS) return 0;
  const parts = os.release().split('.');
  return Number(parts[2]) || 0;
}

function detectMaterial() {
  // Windows Mica samples the system wallpaper. When a live wallpaper tool
  // (Wallpaper Engine, Lively, etc.) draws its own window and leaves the
  // system wallpaper black, Mica reads black and looks like a flat panel.
  // Acrylic samples the windows behind the widget instead, so it keeps the
  // glass look over animated wallpapers. We still call it "Mica transparent"
  // in the UI because that is the material the design is based on.
  return IS_WINDOWS && windowsBuildNumber() >= 22621 ? 'acrylic' : 'fallback';
}

function isGlassMaterial(material = materialState) {
  return material === 'mica' || material === 'acrylic';
}

function getThemeState() {
  if (FORCE_THEME) {
    return {
      theme: FORCE_THEME,
      themePalette: null,
      themeSource: 'forced',
      themeName: '',
      themeScheme: '',
    };
  }

  if (spotifyTheme) {
    return {
      theme: spotifyTheme.mode,
      themePalette: spotifyTheme.palette,
      themeSource: spotifyTheme.source,
      themeName: spotifyTheme.themeName,
      themeScheme: spotifyTheme.schemeName,
    };
  }

  return {
    theme: nativeTheme.shouldUseDarkColors ? 'dark' : 'light',
    themePalette: null,
    themeSource: 'system',
    themeName: '',
    themeScheme: '',
  };
}

function getUiState() {
  return {
    ...getThemeState(),
    material: materialState,
    demo: DEMO,
    demoEmpty: DEMO_EMPTY,
    screenshot: SCREENSHOT,
    platform: process.platform,
    alwaysOnTop: mainWindow?.isAlwaysOnTop() ?? true,
    searchQuery: SEARCH_QUERY,
    playlistUri: PLAYLIST_URI,
  };
}

function getInitialBounds() {
  const width = WINDOW.width;
  const height = WINDOW.height;
  const saved = config.get('windowBounds');

  if (
    saved &&
    Number.isFinite(saved.x) &&
    Number.isFinite(saved.y)
  ) {
    const display = screen.getDisplayMatching({ x: saved.x, y: saved.y, width, height });
    const area = display.workArea;
    const visibleWidth =
      Math.min(saved.x + width, area.x + area.width) - Math.max(saved.x, area.x);
    const visibleHeight =
      Math.min(saved.y + height, area.y + area.height) - Math.max(saved.y, area.y);

    if (visibleWidth >= 140 && visibleHeight >= 140) {
      return {
        x: clamp(saved.x, area.x, area.x + area.width - width),
        y: clamp(saved.y, area.y, area.y + area.height - height),
      };
    }
  }

  const area = screen.getPrimaryDisplay().workArea;
  return {
    x: area.x + area.width - width - 24,
    y: area.y + 24,
  };
}

function createService() {
  if (DEMO) {
    return new DemoService({ empty: DEMO_EMPTY, offline: DEMO_OFFLINE });
  }

  return new SpotifyService({
    pollIntervalMs: process.env.POLL_INTERVAL_MS,
    hiddenPollIntervalMs: process.env.HIDDEN_POLL_INTERVAL_MS,
    readMediaPosition: mediaPositionReader?.read || null,
  });
}

function broadcastState(snapshot = service?.snapshot()) {
  if (!snapshot) return;
  updateTrayMenu(snapshot);

  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('spotify:state', {
    ...snapshot,
    ui: getUiState(),
  });
}

function broadcastUi() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('ui:changed', getUiState());
}

function refreshTheme({ broadcast = true } = {}) {
  if (!themeReader) return;

  let next = null;
  try {
    next = themeReader.read();
  } catch (error) {
    console.warn(`[theme] Could not read the Spotify theme: ${error.message}`);
  }

  const signature = next ? JSON.stringify(next) : '';
  if (signature === lastThemeSignature) return;

  lastThemeSignature = signature;
  spotifyTheme = next;

  if (broadcast) broadcastUi();
}

function sendToast(message, kind = 'error') {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('ui:toast', { kind, message });
}

function showWindow({ focus = true, openSettings = false, openQueue = false } = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  refreshTheme();
  mainWindow.setAlwaysOnTop(true, 'floating');
  if (focus) mainWindow.focus();
  service?.setWindowVisible(true);
  updateTrayMenu();

  if (openSettings) {
    mainWindow.webContents.send('ui:open-settings');
  } else if (openQueue) {
    mainWindow.webContents.send('ui:open-queue');
  }
}

function hideWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.hide();
  service?.setWindowVisible(false);
  updateTrayMenu();
}

function toggleWindow() {
  if (!mainWindow) return;
  if (mainWindow.isVisible()) hideWindow();
  else showWindow();
}

function quitApp() {
  isQuitting = true;
  app.quit();
}

function saveWindowBounds() {
  if (boundsSaveTimer) {
    clearTimeout(boundsSaveTimer);
    boundsSaveTimer = null;
  }
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const bounds = mainWindow.getBounds();
  config.set('windowBounds', { x: bounds.x, y: bounds.y });
}

function scheduleBoundsSave() {
  if (boundsSaveTimer) clearTimeout(boundsSaveTimer);
  boundsSaveTimer = setTimeout(() => {
    boundsSaveTimer = null;
    saveWindowBounds();
  }, 350);
  boundsSaveTimer.unref?.();
}

function ensureWindowVisible() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const bounds = mainWindow.getBounds();
  const displays = screen.getAllDisplays();

  const isVisible = displays.some((display) => {
    const area = display.workArea;
    const visibleWidth =
      Math.min(bounds.x + bounds.width, area.x + area.width) - Math.max(bounds.x, area.x);
    const visibleHeight =
      Math.min(bounds.y + bounds.height, area.y + area.height) - Math.max(bounds.y, area.y);
    return visibleWidth >= 120 && visibleHeight >= 120;
  });

  if (isVisible) return;

  const area = screen.getPrimaryDisplay().workArea;
  mainWindow.setPosition(
    clamp(bounds.x, area.x, area.x + area.width - bounds.width),
    clamp(bounds.y, area.y, area.y + area.height - bounds.height),
  );
}

let lastContentSize = { width: WINDOW.width, height: WINDOW.height };

function enforceContentAspect() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMaximized() || mainWindow.isMinimized() || mainWindow.isFullScreen()) return;

  const [width, height] = mainWindow.getContentSize();
  const dw = Math.abs(width - lastContentSize.width);
  const dh = Math.abs(height - lastContentSize.height);
  if (dw < 1 && dh < 1) return;

  const targetRatio = WINDOW.width / WINDOW.height;
  let nextWidth = width;
  let nextHeight = height;
  if (dw >= dh) nextHeight = Math.round(width / targetRatio);
  else nextWidth = Math.round(height * targetRatio);

  // Keep the widget within the same bounds the window was created with.
  nextWidth = clamp(nextWidth, 300, 760);
  nextHeight = Math.round(nextWidth / targetRatio);

  lastContentSize = { width: nextWidth, height: nextHeight };
  mainWindow.setContentSize(nextWidth, nextHeight);
}

function createWindow() {
  const bounds = getInitialBounds();
  const opacity = SCREENSHOT ? 1 : Number(config.get('opacity')) || WINDOW.defaultOpacity;
  const glass = isGlassMaterial();

  mainWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: WINDOW.width,
    height: WINDOW.height,
    minWidth: 300,
    minHeight: 250,
    maxWidth: 760,
    maxHeight: 640,
    resizable: true,
    frame: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    hasShadow: true,
    roundedCorners: true,
    backgroundColor: '#00000000',
    backgroundMaterial: glass ? materialState : undefined,
    transparent: !glass,
    title: APP_NAME,
    icon: path.join(ROOT_DIR, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      devTools: !app.isPackaged,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.setAlwaysOnTop(true, 'floating');
  // Keep the widget perfectly proportional when the user resizes it.
  // The constructor `aspectRatio` option is not supported on Windows,
  // so this has to go through the runtime API. The invisible resize
  // borders are excluded so the content stays exactly 392x330.
  mainWindow.on('resize', enforceContentAspect);

  if (glass) {
    // Window-level opacity makes the DWM backdrop disappear on Windows.
    // Glass transparency is handled by the renderer tint instead.
    mainWindow.setOpacity(1);
    try {
      mainWindow.setBackgroundMaterial(materialState);
    } catch (error) {
      console.warn(`[window] ${materialState} could not be applied: ${error.message}`);
      materialState = 'fallback';
      mainWindow.setOpacity(clamp(opacity, WINDOW.minOpacity, 1));
    }
  } else {
    mainWindow.setOpacity(clamp(opacity, WINDOW.minOpacity, 1));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (!SCREENSHOT) mainWindow.focus();
  });

  mainWindow.on('move', scheduleBoundsSave);
  mainWindow.on('show', () => {
    service?.setWindowVisible(true);
    updateTrayMenu();
  });
  mainWindow.on('hide', () => {
    service?.setWindowVisible(false);
    updateTrayMenu();
  });
  mainWindow.on('close', (event) => {
    if (isQuitting) {
      saveWindowBounds();
      return;
    }
    event.preventDefault();
    hideWindow();
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault();
  });

  mainWindow.webContents.once('did-finish-load', () => {
    const delayedEvents = [
      OPEN_SETTINGS_ON_START ? 'ui:open-settings' : null,
      OPEN_QUEUE_ON_START ? 'ui:open-queue' : null,
      OPEN_SEARCH_ON_START ? 'ui:open-search' : null,
      OPEN_PLAYLISTS_ON_START || PLAYLIST_URI ? 'ui:open-playlists' : null,
    ].filter(Boolean);

    if (delayedEvents.length) {
      setTimeout(() => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        for (const channel of delayedEvents) {
          mainWindow.webContents.send(channel);
        }
      }, 600);
    }

    if (!SCREENSHOT) return;
    if (screenshotStarted) return;
    screenshotStarted = true;
    setTimeout(() => {
      capturePreview().catch((error) => {
        console.warn(`[screenshot] Failed: ${error.message}`);
        isQuitting = true;
        app.quit();
      });
    }, SCREENSHOT_DELAY);
  });

  mainWindow.loadFile(path.join(ROOT_DIR, 'renderer', 'index.html'));
}

function buildTrayMenu(snapshot = service?.snapshot()) {
  const playback = snapshot?.playback;
  const canControl = Boolean(playback) && snapshot?.status === 'online';
  const nowPlaying = playback
    ? `${playback.title} — ${playback.artist}`
    : 'Nothing playing';

  const template = [
    {
      label: mainWindow?.isVisible() ? 'Hide widget' : 'Show widget',
      click: toggleWindow,
    },
    { type: 'separator' },
    {
      label: DEMO ? `Demo · ${nowPlaying}` : nowPlaying,
      enabled: false,
    },
    {
      label: playback?.isPlaying ? 'Pause' : 'Play',
      enabled: canControl,
      click: () => {
        runTrayAction(() => service.togglePlayback());
      },
    },
    {
      label: 'Next track',
      enabled: canControl,
      click: () => {
        runTrayAction(() => service.skipToNext());
      },
    },
    {
      label: 'Previous track',
      enabled: canControl,
      click: () => {
        runTrayAction(() => service.skipToPrevious());
      },
    },
    { type: 'separator' },
    {
      label: 'Search Spotify…',
      click: () => {
        showWindow();
        mainWindow?.webContents.send('ui:open-search');
      },
    },
    {
      label: 'Your playlists',
      click: () => {
        showWindow();
        mainWindow?.webContents.send('ui:open-playlists');
      },
    },
    {
      label: 'Show queue',
      click: () => showWindow({ openQueue: true }),
    },
    {
      label: 'Settings…',
      click: () => showWindow({ openSettings: true }),
    },
    {
      label: 'Open Spotify',
      click: () => {
        runTrayAction(() => service.openSpotify());
      },
    },
    { type: 'separator' },
    {
      label: 'Quit Spotify Mini Player',
      click: quitApp,
    },
  ];

  return Menu.buildFromTemplate(template);
}

async function runTrayAction(action) {
  try {
    await action();
  } catch (error) {
    const publicError = toPublicError(error);
    sendToast(publicError.message);
  }
}

function updateTrayMenu(snapshot = service?.snapshot()) {
  if (!tray || tray.isDestroyed()) return;

  const playback = snapshot?.playback;
  const signature = [
    mainWindow?.isVisible() ? 'visible' : 'hidden',
    snapshot?.status || '',
    playback?.title || '',
    playback?.artist || '',
    playback?.isPlaying ? 'playing' : 'paused',
  ].join('|');

  if (signature === lastTraySignature) return;
  lastTraySignature = signature;

  tray.setToolTip(
    playback
      ? `${APP_NAME}\n${playback.title} — ${playback.artist}`
      : APP_NAME,
  );
  tray.setContextMenu(buildTrayMenu(snapshot));
}

function createTray() {
  const iconPath = path.join(ROOT_DIR, 'assets', 'tray.png');
  let image = nativeImage.createFromPath(iconPath);

  if (image.isEmpty()) {
    image = nativeImage.createFromPath(path.join(ROOT_DIR, 'assets', 'icon.png'));
  }
  if (image.isEmpty()) {
    image = nativeImage.createEmpty();
  }

  tray = new Tray(image);
  tray.setToolTip(APP_NAME);
  tray.setIgnoreDoubleClickEvents(true);
  tray.on('click', toggleWindow);
  updateTrayMenu();
}

function isTrustedSender(event) {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  if (event.sender !== mainWindow.webContents) return false;
  return !event.senderFrame || event.senderFrame === mainWindow.webContents.mainFrame;
}

function registerHandler(channel, handler) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (!isTrustedSender(event)) {
      return {
        ok: false,
        error: { code: 'FORBIDDEN', message: 'This request did not come from the widget.' },
      };
    }

    try {
      return { ok: true, data: await handler(...args) };
    } catch (error) {
      const publicError = toPublicError(error);
      if (publicError.code === 'UNKNOWN') {
        console.error(`[ipc] ${channel} failed:`, error);
      }
      return { ok: false, error: publicError };
    }
  });
}

function setupIpc() {
  registerHandler('spotify:get-state', () => ({
    ...service.snapshot(),
    ui: getUiState(),
  }));

  registerHandler('settings:get', () => ({
    opacity: Number(config.get('opacity')) || WINDOW.defaultOpacity,
    minOpacity: WINDOW.minOpacity,
    maxOpacity: 1,
    viewMode: config.get('viewMode', 'default'),
    showSongName: config.get('showSongName', true),
    version: app.getVersion(),
    material: materialState,
    cli: service.snapshot().cli,
    ui: getUiState(),
  }));

  registerHandler('settings:set-view-mode', (value) => {
    const mode = String(value || '');
    if (!['controls', 'default', 'cd'].includes(mode)) {
      throw new AppError('INVALID_VIEW_MODE', 'Choose a valid widget view.');
    }
    config.set('viewMode', mode);
    return { viewMode: mode };
  });

  registerHandler('settings:set-show-song-name', (value) => {
    const enabled = Boolean(value);
    config.set('showSongName', enabled);
    return { showSongName: enabled };
  });

  registerHandler('settings:set-opacity', (value) => {
    const opacity = Number(value);
    if (!Number.isFinite(opacity)) {
      throw new AppError('INVALID_OPACITY', 'Opacity must be a number.');
    }

    const next = clamp(opacity, WINDOW.minOpacity, 1);
    config.set('opacity', next);
    // On glass materials the tint lives in the renderer; changing the native
    // window opacity would replace the backdrop with a flat transparent window.
    if (!isGlassMaterial()) {
      mainWindow.setOpacity(next);
    }
    return { opacity: next, material: materialState };
  });

  registerHandler('spotify:refresh', () => service.refreshNow());
  registerHandler('spotify:toggle', () => service.togglePlayback());
  registerHandler('spotify:next', () => service.skipToNext());
  registerHandler('spotify:previous', () => service.skipToPrevious());
  registerHandler('spotify:set-volume', (value) => service.setVolume(value));
  registerHandler('spotify:get-queue', (options) => service.getQueue(options || {}));
  registerHandler('spotify:remove-from-queue', (position) => service.removeFromQueue(position));
  registerHandler('spotify:add-to-queue', (uri) => service.addToQueue(uri));
  registerHandler('spotify:search', (query, type) => service.search(query, type));
  registerHandler('spotify:play-uri', (uri) => service.playUri(uri));
  registerHandler('spotify:seek', (positionMs) => service.seek(positionMs));
  registerHandler('spotify:get-playlists', (options) => service.getPlaylists(options || {}));
  registerHandler('spotify:get-playlist', (uri, options) => service.getPlaylist(uri, options || {}));

  registerHandler('window:hide', () => {
    hideWindow();
    return true;
  });

  registerHandler('window:move-by', (dx, dy) => {
    if (!mainWindow || mainWindow.isDestroyed()) return true;
    const bounds = mainWindow.getBounds();
    const x = Math.round(bounds.x + (Number(dx) || 0));
    const y = Math.round(bounds.y + (Number(dy) || 0));
    mainWindow.setPosition(x, y);
    return true;
  });

  registerHandler('window:move-to', (x, y) => {
    if (!mainWindow || mainWindow.isDestroyed()) return true;
    mainWindow.setPosition(Math.round(Number(x) || 0), Math.round(Number(y) || 0));
    return true;
  });
  registerHandler('window:quit', () => {
    quitApp();
    return true;
  });

  registerHandler('app:open-spotify', async () => {
    await service.openSpotify();
    return true;
  });
  registerHandler('app:open-spotify-download', async () => {
    await shell.openExternal('https://www.spotify.com/download/windows/');
    return true;
  });
}

async function capturePreview() {
  const bounds = mainWindow.getBounds();
  const display = screen.getDisplayMatching(bounds);
  let image = null;

  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: Math.round(display.size.width * display.scaleFactor),
        height: Math.round(display.size.height * display.scaleFactor),
      },
      fetchWindowIcons: false,
    });

    const source =
      sources.find((item) => String(item.display_id) === String(display.id)) || sources[0];

    if (source && !source.thumbnail.isEmpty()) {
      const full = source.thumbnail;
      const size = full.getSize();
      const scaleX = size.width / display.size.width;
      const scaleY = size.height / display.size.height;
      const x = Math.round((bounds.x - display.bounds.x) * scaleX);
      const y = Math.round((bounds.y - display.bounds.y) * scaleY);
      const width = Math.min(Math.round(bounds.width * scaleX), size.width - x);
      const height = Math.min(Math.round(bounds.height * scaleY), size.height - y);

      if (x >= 0 && y >= 0 && width > 0 && height > 0) {
        image = full.crop({ x, y, width, height });
      }
    }
  } catch (error) {
    console.warn(`[screenshot] Desktop capture unavailable: ${error.message}`);
  }

  if (!image || image.isEmpty()) {
    image = await mainWindow.webContents.capturePage();
  }

  fs.mkdirSync(path.dirname(SCREENSHOT_PATH), { recursive: true });
  fs.writeFileSync(SCREENSHOT_PATH, image.toPNG());
  console.log(`[screenshot] Saved ${SCREENSHOT_PATH}`);

  isQuitting = true;
  app.quit();
}

async function bootstrap() {
  materialState = detectMaterial();
  if (FORCE_THEME) nativeTheme.themeSource = FORCE_THEME;

  // Theme sync disabled: use the widget's built-in default/system theme.
  themeReader = null;
  spotifyTheme = null;

  mediaPositionReader = createMediaPositionReader({
    directory: app.getPath('userData'),
    logger: console,
  });

  service = createService();
  service.on('state', (snapshot) => broadcastState(snapshot));

  setupIpc();
  createWindow();
  createTray();

  // Theme polling disabled.
  themeTimer = null;

  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
  session.defaultSession.setPermissionCheckHandler(() => false);

  nativeTheme.on('updated', broadcastUi);

  screen.on('display-removed', ensureWindowVisible);
  screen.on('display-metrics-changed', ensureWindowVisible);

  service.start().catch((error) => {
    console.error('[spotify] Service failed to start:', error);
    sendToast(toPublicError(error).message);
  });

  // The renderer fetches the latest snapshot itself, so a state emitted before
  // the page is ready is never lost.
  setTimeout(() => broadcastState(), 800).unref?.();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showWindow();
  });

  app.on('before-quit', () => {
    isQuitting = true;
    if (themeTimer) clearInterval(themeTimer);
    saveWindowBounds();
    config.flush();
    service?.stop();
  });

  app.on('will-quit', () => {
    service?.stop();
    config.flush();
    if (tray && !tray.isDestroyed()) tray.destroy();
  });

  app.on('activate', () => {
    showWindow();
  });

  app.whenReady().then(bootstrap).catch((error) => {
    console.error('[app] Failed to start:', error);
    app.quit();
  });
}
