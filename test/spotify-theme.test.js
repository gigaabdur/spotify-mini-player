'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  createSpotifyThemeReader,
  normalizeHex,
  paletteFromColors,
  parseIni,
  relativeLuminance,
} = require('../electron/lib/spotify-theme');

const QUINTESSENTIAL_COLORS = {
  text: 'f5e6d3',
  subtext: 'd4b896',
  main: '1a1218',
  'main-elevated': '241a22',
  highlight: '2e222c',
  'highlight-elevated': '3a2a36',
  sidebar: '140e14',
  player: '1a1218',
  card: '241a22',
  shadow: '000000',
  'selected-row': '2e222c',
  button: 'fbbf24',
  'button-active': 'f59e0b',
  'button-disabled': '6b5a62',
  misc: 'ff6b9d',
  notification: 'fbbf24',
  'notification-error': 'f87171',
  'playback-bar': 'fbbf24',
};

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'smp-theme-'));
}

function writeFile(root, relativePath, contents) {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, 'utf8');
}

test('normalizeHex accepts Spotify color.ini values', () => {
  assert.equal(normalizeHex('fbbf24'), '#fbbf24');
  assert.equal(normalizeHex('#FBBF24'), '#fbbf24');
  assert.equal(normalizeHex('abc'), '#aabbcc');
  assert.equal(normalizeHex('  #abc  '), '#aabbcc');
  assert.equal(normalizeHex(''), null);
  assert.equal(normalizeHex('not-a-color'), null);
  assert.equal(normalizeHex(null), null);
});

test('relativeLuminance distinguishes dark and light backgrounds', () => {
  assert.ok(relativeLuminance('1a1218') < 0.1);
  assert.ok(relativeLuminance('fafafa') > 0.9);
  assert.equal(relativeLuminance('invalid'), 0);
});

test('parseIni reads sections, comments, and values', () => {
  const ini = parseIni(`
; a comment
[Setting]
current_theme = QuintessentialQuintuplets
color_scheme = Nakano Family
inject_css = 1

[Nakano Family]
main = 1a1218
text = f5e6d3
`);

  assert.equal(ini.Setting.current_theme, 'QuintessentialQuintuplets');
  assert.equal(ini.Setting.color_scheme, 'Nakano Family');
  assert.equal(ini['Nakano Family'].main, '1a1218');
  assert.equal(ini['Nakano Family'].text, 'f5e6d3');
});

test('paletteFromColors maps a Spicetify color scheme', () => {
  const theme = paletteFromColors(QUINTESSENTIAL_COLORS, {
    themeName: 'QuintessentialQuintuplets',
    schemeName: 'Nakano Family',
  });

  assert.ok(theme);
  assert.equal(theme.mode, 'dark');
  assert.equal(theme.palette.mode, 'dark');
  assert.equal(theme.themeName, 'QuintessentialQuintuplets');
  assert.equal(theme.schemeName, 'Nakano Family');
  assert.equal(theme.palette.background, '#1a1218');
  assert.equal(theme.palette.backgroundElevated, '#241a22');
  assert.equal(theme.palette.sidebar, '#140e14');
  assert.equal(theme.palette.text, '#f5e6d3');
  assert.equal(theme.palette.subtext, '#d4b896');
  assert.equal(theme.palette.accent, '#fbbf24');
  assert.equal(theme.palette.accentActive, '#f59e0b');
  assert.equal(theme.palette.secondary, '#ff6b9d');
  assert.equal(theme.palette.notificationError, '#f87171');
});

test('paletteFromColors detects light schemes', () => {
  const theme = paletteFromColors(
    {
      main: 'fafafa',
      text: '17191d',
      button: '1db954',
    },
    { themeName: 'Light', schemeName: 'Default' },
  );

  assert.ok(theme);
  assert.equal(theme.mode, 'light');
  assert.equal(theme.palette.mode, 'light');
  assert.equal(theme.palette.background, '#fafafa');
  assert.equal(theme.palette.accent, '#1db954');
  assert.equal(theme.palette.subtext, '#17191d');
});

test('paletteFromColors rejects schemes without a usable background and text', () => {
  assert.equal(paletteFromColors(null), null);
  assert.equal(paletteFromColors({ text: 'f5e6d3' }), null);
  assert.equal(paletteFromColors({ main: '1a1218' }), null);
  assert.equal(paletteFromColors({ main: 'nope', text: 'f5e6d3' }), null);
});

test('reader uses the applied Spicetify theme JSON', () => {
  const appData = createTempDir();
  try {
    writeFile(
      appData,
      path.join('Spotify', 'Apps', 'xpui', 'spicetify-config.json'),
      JSON.stringify({
        theme_name: 'QuintessentialQuintuplets',
        scheme_name: 'Nakano Family',
        schemes: {
          default: {},
          'nakano family': QUINTESSENTIAL_COLORS,
        },
      }),
    );

    const reader = createSpotifyThemeReader({ appDataDir: appData });
    const theme = reader.read();

    assert.ok(theme);
    assert.equal(theme.source, 'spicetify');
    assert.equal(theme.themeName, 'QuintessentialQuintuplets');
    assert.equal(theme.schemeName, 'nakano family');
    assert.equal(theme.mode, 'dark');
    assert.equal(theme.palette.accent, '#fbbf24');
  } finally {
    fs.rmSync(appData, { recursive: true, force: true });
  }
});

test('reader falls back to Spicetify config and color.ini', () => {
  const appData = createTempDir();
  try {
    writeFile(
      appData,
      path.join('spicetify', 'config-xpui.ini'),
      `[Setting]
current_theme = QuintessentialQuintuplets
color_scheme = Nakano Family
inject_css = 1
`,
    );
    writeFile(
      appData,
      path.join(
        'spicetify',
        'Themes',
        'QuintessentialQuintuplets',
        'color.ini',
      ),
      `[Nakano Family]
main = 1a1218
text = f5e6d3
button = fbbf24
`,
    );

    const reader = createSpotifyThemeReader({ appDataDir: appData });
    const theme = reader.read();

    assert.ok(theme);
    assert.equal(theme.themeName, 'QuintessentialQuintuplets');
    assert.equal(theme.schemeName, 'Nakano Family');
    assert.equal(theme.palette.background, '#1a1218');
    assert.equal(theme.palette.accent, '#fbbf24');
  } finally {
    fs.rmSync(appData, { recursive: true, force: true });
  }
});

test('reader matches the scheme name case-insensitively', () => {
  const appData = createTempDir();
  try {
    writeFile(
      appData,
      path.join('spicetify', 'config-xpui.ini'),
      `[Setting]
current_theme = TestTheme
color_scheme = NAKANO FAMILY
inject_css = 1
`,
    );
    writeFile(
      appData,
      path.join('spicetify', 'Themes', 'TestTheme', 'color.ini'),
      `[Nakano Family]
main = 1a1218
text = f5e6d3
button = fbbf24
`,
    );

    const reader = createSpotifyThemeReader({ appDataDir: appData });
    const theme = reader.read();

    assert.ok(theme);
    assert.equal(theme.schemeName, 'Nakano Family');
  } finally {
    fs.rmSync(appData, { recursive: true, force: true });
  }
});

test('extractSkin reads fonts, crest, ribbon, and glows from user.css', () => {
  const css = `
    :root { --qq-five: linear-gradient(90deg, #ff6b9d, #d946ef); }
    html, body { font-family: "Segoe UI", system-ui, sans-serif !important; }
    .main-card-card footer, [class*="subtitle"] { font-family: "Brush Script MT", cursive !important; }
    button[aria-label="Play"] {
      background-color: #140e14 !important;
      background-image: url("data:image/svg+xml;base64,AAAA") !important;
      background-size: 70% !important;
      border: 2px solid rgba(251,191,36,.6) !important;
      box-shadow: 0 0 20px rgba(251,191,36,.5) !important;
    }
    .playback-bar input[type="range"]::-webkit-slider-runnable-track {
      background: linear-gradient(90deg, #ff6b9d, #d946ef, #38bdf8) !important;
      box-shadow: inset 0 0 6px rgba(255,255,255,.25) !important;
    }
    .playback-bar input[type="range"]::-webkit-slider-thumb {
      background: url("data:image/svg+xml;base64,BBBB") center/contain no-repeat !important;
      box-shadow: 0 0 10px rgba(251,191,36,.7) !important;
    }
    .main-card-card { background: linear-gradient(160deg, #2a1f28, #1f1620) !important; border: 1px solid rgba(251,191,36,.25) !important; border-radius: 14px !important; }
    .Root__nav-bar button { border-radius: 8px !important; }
    ::-webkit-scrollbar-thumb { background: linear-gradient(90deg, #ff6b9d, #fbbf24); border-radius: 10px; }
    body::before { background: radial-gradient(10px 10px at 10% 10%, rgba(255,0,0,.1), transparent 60%); }
  `;
  const { extractSkin } = require('../electron/lib/spotify-theme');
  const skin = extractSkin(css);
  assert.equal(skin.font, '"Segoe UI", system-ui, sans-serif');
  assert.equal(skin.subtitleFont, '"Brush Script MT", cursive');
  assert.match(skin.playImage, /^url\("data:image\/svg\+xml;base64,AAAA"\)$/);
  assert.equal(skin.playBackground, '#140e14');
  assert.equal(skin.playBorder, '2px solid rgba(251,191,36,.6)');
  assert.match(skin.progressTrack, /linear-gradient/);
  assert.match(skin.progressThumb, /BBBB/);
  assert.equal(skin.cardRadius, '14px');
  assert.equal(skin.buttonRadius, '8px');
  assert.equal(skin.scrollbarRadius, '10px');
  assert.match(skin.glow, /radial-gradient/);
});

test('reader attaches a skin when the theme has user.css', () => {
  const appData = createTempDir();
  try {
    writeFile(
      appData,
      path.join('Spotify', 'Apps', 'xpui', 'spicetify-config.json'),
      JSON.stringify({
        theme_name: 'SkinTheme',
        scheme_name: 'Default',
        schemes: {
          default: QUINTESSENTIAL_COLORS,
        },
      }),
    );
    writeFile(
      appData,
      path.join('spicetify', 'Themes', 'SkinTheme', 'manifest.json'),
      JSON.stringify({ name: 'SkinTheme', usercss: 'user.css' }),
    );
    writeFile(
      appData,
      path.join('spicetify', 'Themes', 'SkinTheme', 'user.css'),
      'html, body { font-family: "Trebuchet MS", sans-serif !important; }',
    );

    const reader = createSpotifyThemeReader({ appDataDir: appData });
    const theme = reader.read();
    assert.ok(theme);
    assert.ok(theme.skin);
    assert.equal(theme.skin.font, '"Trebuchet MS", sans-serif');
  } finally {
    fs.rmSync(appData, { recursive: true, force: true });
  }
});

test('reader returns null when Spicetify is not installed or disabled', () => {
  const empty = createTempDir();
  const disabled = createTempDir();
  try {
    writeFile(
      disabled,
      path.join('spicetify', 'config-xpui.ini'),
      `[Setting]
current_theme = TestTheme
color_scheme = Default
inject_css = 0
`,
    );

    assert.equal(createSpotifyThemeReader({ appDataDir: empty }).read(), null);
    assert.equal(createSpotifyThemeReader({ appDataDir: disabled }).read(), null);
  } finally {
    fs.rmSync(empty, { recursive: true, force: true });
    fs.rmSync(disabled, { recursive: true, force: true });
  }
});
