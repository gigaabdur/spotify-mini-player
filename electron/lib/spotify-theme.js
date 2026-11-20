'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { FALLBACK_ACCENT } = require('./constants');

const HEX_COLOR = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

function normalizeHex(value) {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(HEX_COLOR);
  if (!match) return null;

  let hex = match[1].toLowerCase();
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((character) => character + character)
      .join('');
  }

  return `#${hex}`;
}

function relativeLuminance(hex) {
  const color = normalizeHex(hex);
  if (!color) return 0;

  const channels = [1, 3, 5].map((index) => {
    const value = parseInt(color.slice(index, index + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function parseIni(text) {
  const result = {};
  let section = null;

  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith(';') || line.startsWith('#')) continue;

    const sectionMatch = line.match(/^\[(.+)\]$/);
    if (sectionMatch) {
      section = sectionMatch[1].trim();
      result[section] = result[section] || {};
      continue;
    }

    const equals = line.indexOf('=');
    if (equals <= 0) continue;

    const key = line.slice(0, equals).trim();
    const value = line.slice(equals + 1).trim();
    if (!section) continue;
    result[section][key] = value;
  }

  return result;
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function readJson(filePath) {
  const text = readText(filePath);
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function findSection(ini, name) {
  const sections = Object.keys(ini);
  if (!sections.length) return null;

  const exact = name && sections.find((section) => section === name);
  const insensitive = name
    ? sections.find((section) => section.toLowerCase() === String(name).toLowerCase())
    : null;
  const section = exact || insensitive || sections[0];

  return {
    name: section,
    values: ini[section] || {},
  };
}

function pick(colors, key, fallback) {
  return normalizeHex(colors[key]) || fallback;
}

function paletteFromColors(colors, meta = {}) {
  if (!colors || typeof colors !== 'object') return null;

  const main = normalizeHex(colors.main);
  const text = normalizeHex(colors.text);
  if (!main || !text) return null;

  const elevated = pick(colors, 'main-elevated', main);
  const highlight = pick(colors, 'highlight', elevated);
  const highlightElevated = pick(colors, 'highlight-elevated', highlight);
  const accent = pick(colors, 'button', pick(colors, 'misc', FALLBACK_ACCENT));
  const subtext = pick(colors, 'subtext', text);
  const mode = relativeLuminance(main) > 0.5 ? 'light' : 'dark';

  return {
    source: meta.source || 'spicetify',
    themeName: meta.themeName || '',
    schemeName: meta.schemeName || '',
    mode,
    skin: null,
    palette: {
      mode,
      accent,
      accentActive: pick(colors, 'button-active', accent),
      accentDisabled: pick(colors, 'button-disabled', subtext),
      secondary: pick(colors, 'misc', accent),
      background: main,
      backgroundElevated: elevated,
      sidebar: pick(colors, 'sidebar', main),
      player: pick(colors, 'player', main),
      card: pick(colors, 'card', elevated),
      shadow: pick(colors, 'shadow', '#000000'),
      selectedRow: pick(colors, 'selected-row', highlight),
      highlight,
      highlightElevated,
      text,
      subtext,
      notification: pick(colors, 'notification', accent),
      notificationError: pick(colors, 'notification-error', '#f87171'),
      playbackBar: pick(colors, 'playback-bar', accent),
    },
  };
}

/* ---------- CSS parsing helpers for theme skins ---------- */

function stripComments(css) {
  return String(css || '').replace(/\/\*[\s\S]*?\*\//g, '');
}

function findMatchingBrace(text, start) {
  let depth = 0;
  let quote = null;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === quote && text[i - 1] !== '\\') quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function removeAtRuleBlocks(css) {
  const pattern = /@(?:media|supports|keyframes|-webkit-keyframes|font-face|layer|container|document|page)\b/gi;
  let result = css;
  let match;
  while ((match = pattern.exec(result)) !== null) {
    const start = match.index;
    const brace = result.indexOf('{', start);
    const semi = result.indexOf(';', start);
    if (brace === -1 || (semi !== -1 && semi < brace)) {
      const end = semi === -1 ? result.length : semi + 1;
      result = result.slice(0, start) + result.slice(end);
      pattern.lastIndex = start;
      continue;
    }
    const close = findMatchingBrace(result, brace);
    if (close === -1) break;
    result = result.slice(0, start) + result.slice(close + 1);
    pattern.lastIndex = start;
  }
  return result;
}

function splitTopLevel(text, delimiter) {
  const parts = [];
  let current = '';
  let depth = 0;
  let quote = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      current += ch;
      if (ch === quote && text[i - 1] !== '\\') quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') depth = Math.max(0, depth - 1);
    if (ch === delimiter && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  parts.push(current);
  return parts;
}

function findPropertyColon(text) {
  let depth = 0;
  let quote = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === quote && text[i - 1] !== '\\') quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') depth = Math.max(0, depth - 1);
    else if (ch === ':' && depth === 0) return i;
  }
  return -1;
}

function parseDeclarations(body) {
  const result = {};
  const parts = splitTopLevel(body, ';');
  for (const part of parts) {
    const colonIndex = findPropertyColon(part);
    if (colonIndex === -1) continue;
    const prop = part.slice(0, colonIndex).trim().toLowerCase();
    let value = part.slice(colonIndex + 1).trim();
    if (!prop || !value) continue;
    value = value.replace(/\s*!important\s*$/i, '').trim();
    if (value) result[prop] = value;
  }
  return result;
}

function parseRules(css) {
  const rules = [];
  let index = 0;
  while (index < css.length) {
    const open = css.indexOf('{', index);
    if (open === -1) break;
    const close = findMatchingBrace(css, open);
    if (close === -1) break;
    const selector = css.slice(index, open).trim();
    const body = css.slice(open + 1, close);
    if (selector && !selector.startsWith('@')) {
      const decls = parseDeclarations(body);
      if (Object.keys(decls).length) rules.push({ selector, declarations: decls });
    }
    index = close + 1;
  }
  return rules;
}

function resolveValue(value, vars, depth = 0) {
  if (typeof value !== 'string' || depth > 8) return value;
  return value.replace(/var\(\s*(--[A-Za-z0-9_-]+)\s*(?:,\s*([^)]*))?\)/g, (_m, name, fallback) => {
    if (Object.prototype.hasOwnProperty.call(vars, name)) {
      return resolveValue(vars[name], vars, depth + 1);
    }
    return fallback ? resolveValue(String(fallback).trim(), vars, depth + 1) : '';
  });
}

function collectVariables(rules) {
  const vars = {};
  for (const rule of rules) {
    const selector = rule.selector.toLowerCase();
    if (!/(^|,)\s*(:root|html|body)\b/.test(selector)) continue;
    for (const [prop, value] of Object.entries(rule.declarations)) {
      if (prop.startsWith('--')) vars[prop] = value;
    }
  }
  return vars;
}

function parseCss(cssText) {
  const css = removeAtRuleBlocks(stripComments(cssText));
  const rules = parseRules(css);
  const rawVars = collectVariables(rules);
  const vars = {};
  for (const key of Object.keys(rawVars)) {
    vars[key] = resolveValue(rawVars[key], rawVars);
  }
  for (const rule of rules) {
    const resolved = {};
    for (const [prop, val] of Object.entries(rule.declarations)) {
      resolved[prop] = resolveValue(val, vars);
    }
    rule.declarations = resolved;
  }
  return { rules, vars };
}

/* ---------- validators ---------- */

function isValidColor(value) {
  if (typeof value !== 'string') return false;
  const v = value.trim();
  if (!v) return false;
  if (normalizeHex(v)) return true;
  if (/^rgba?\(\s*[\d\s,./%]+\s*\)$/i.test(v)) return true;
  if (/^hsla?\(\s*[\d\s,./%deg]+\s*\)$/i.test(v)) return true;
  if (/^color-mix\(/i.test(v)) {
    if (v.length > 240) return false;
    let depth = 0;
    for (const ch of v) {
      if (ch === '(') depth++;
      else if (ch === ')') {
        depth--;
        if (depth < 0) return false;
      }
    }
    if (depth !== 0) return false;
    if (/[;{}<>]/.test(v)) return false;
    return true;
  }
  return false;
}

function validateColor(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim().replace(/\s*!important\s*$/i, '').trim();
  if (!v) return null;
  if (normalizeHex(v)) return normalizeHex(v);
  if (isValidColor(v)) return v;
  return null;
}

function validateFontFamily(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim().replace(/\s*!important\s*$/i, '').trim();
  if (!v) return null;
  if (/[;{}<>]/.test(v) || /url\(/i.test(v)) return null;
  if (!/^[\w\s,"'()-]+$/.test(v)) return null;
  if (v.length > 300) return null;
  if (!/[A-Za-z]/.test(v)) return null;
  return v;
}

function validateRadius(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim().replace(/\s*!important\s*$/i, '').trim();
  if (!/^\d+(?:\.\d+)?px$/.test(v)) return null;
  const n = parseFloat(v);
  if (n < 0 || n > 64) return null;
  return v;
}

function validateBoxShadow(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim().replace(/\s*!important\s*$/i, '').trim();
  if (!v) return null;
  if (v.toLowerCase() === 'none') return 'none';
  if (/[;{}<>]/.test(v) || /url\(/i.test(v)) return null;
  let depth = 0;
  for (const ch of v) {
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth < 0) return null;
    }
  }
  if (depth !== 0) return null;
  if (v.length > 1200) return null;
  if (!/^[\w\s#(),.%'+\-\/]+$/i.test(v)) return null;
  return v;
}

function validateGradient(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim().replace(/\s*!important\s*$/i, '').trim();
  if (!v) return null;
  if (!/^(linear|radial|conic)-gradient\(/i.test(v)) return null;
  if (/[;{}<>]/.test(v) || /url\(/i.test(v)) return null;
  let depth = 0;
  for (const ch of v) {
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth < 0) return null;
    }
  }
  if (depth !== 0) return null;
  if (v.length > 1200) return null;
  if (!/^[\w\s#(),.%'+\-\/]+$/i.test(v)) return null;
  return v;
}

function validateBackgroundGradient(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim().replace(/\s*!important\s*$/i, '').trim();
  if (!v) return null;
  const layers = splitTopLevel(v, ',');
  if (layers.length === 1) return validateGradient(layers[0].trim());
  const validated = layers.map((layer) => validateGradient(layer.trim()));
  if (validated.every(Boolean)) return validated.join(', ');
  return validateGradient(v);
}

function validateBackgroundValue(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim().replace(/\s*!important\s*$/i, '').trim();
  if (!v) return null;
  const gradient = validateBackgroundGradient(v);
  if (gradient) return gradient;
  return validateColor(v);
}

function validateBorder(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim().replace(/\s*!important\s*$/i, '').trim();
  if (!v) return null;
  if (/[;{}<>]/.test(v) || /url\(/i.test(v)) return null;
  if (v.length > 240) return null;
  if (!/^(\d+(?:\.\d+)?px|thin|medium|thick)\s+(solid|dashed|dotted|double|groove|ridge|inset|outset)\s+.+$/i.test(v)) return null;
  const colorPart = v.replace(/^(\d+(?:\.\d+)?px|thin|medium|thick)\s+(solid|dashed|dotted|double|groove|ridge|inset|outset)\s+/i, '');
  if (!isValidColor(colorPart)) return null;
  return v;
}

function combineBorder(decls) {
  if (!decls || typeof decls !== 'object') return null;
  if (decls.border) return decls.border;
  const width = decls['border-width'];
  const style = decls['border-style'];
  const color = decls['border-color'];
  if (width && style && color) return `${width} ${style} ${color}`;
  return null;
}

function extractDataImageUrl(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(/url\(\s*["']?(data:image\/(?:svg\+xml|png|jpe?g|webp);base64,[A-Za-z0-9+\/=\s]+)["']?\s*\)/i);
  if (!match) return null;
  const dataUrl = match[1].replace(/\s+/g, '');
  if (!/^data:image\/(?:svg\+xml|png|jpe?g|webp);base64,[A-Za-z0-9+\/=]+$/i.test(dataUrl)) return null;
  return `url("${dataUrl}")`;
}

function splitSelectors(selector) {
  return splitTopLevel(String(selector || ''), ',').map((part) => part.trim()).filter(Boolean);
}

function anyPart(selector, predicate) {
  return splitSelectors(selector).some(predicate);
}

function isPlaySelectorPart(part) {
  const s = String(part || '').toLowerCase();
  if (!s || s.includes('::')) return false;
  if (/\b(svg|img|span|path|use)\b/.test(s)) return false;
  if (/aria-label=["']?(play|pause)/.test(s)) return true;
  if (s.includes('playbutton') || s.includes('play-button') || s.includes('control-button-play') || s.endsWith('button.play') || s.includes('main-playbutton')) return true;
  return false;
}

function mergeDeclarations(rules) {
  const merged = {};
  for (const rule of rules) Object.assign(merged, rule.declarations || {});
  return merged;
}

function extractPlay(rules) {
  const candidates = rules.filter((rule) => anyPart(rule.selector, isPlaySelectorPart));
  const merged = mergeDeclarations(candidates);
  return {
    playImage: extractDataImageUrl(merged['background-image'] || merged['background']),
    playBackground: validateColor(merged['background-color']),
    playBorder: validateBorder(combineBorder(merged)),
    playShadow: validateBoxShadow(merged['box-shadow']),
  };
}

function scoreProgressRule(rule) {
  const sel = String(rule.selector || '').toLowerCase();
  const decl = rule.declarations || {};
  const bg = decl['background'] || decl['background-image'] || '';
  if (!/(linear|radial|conic)-gradient/i.test(bg)) return -1;
  let score = 0;
  if (sel.includes('runnable-track')) score += 5;
  if (sel.includes('range')) score += 2;
  if (sel.includes('playback') || sel.includes('progress')) score += 2;
  if (sel.includes('slider')) score += 1;
  const colors = bg.match(/#[0-9a-f]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)/gi) || [];
  score += Math.min(colors.length, 6);
  if (/rgba\(\s*2[0-9]/.test(bg) && colors.length <= 2) score -= 3;
  return score;
}

function extractProgressTrack(rules) {
  const candidates = rules
    .map((rule) => ({ rule, score: scoreProgressRule(rule) }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score);
  if (!candidates.length) return { progressTrack: null, progressTrackShadow: null };
  const decls = candidates[0].rule.declarations || {};
  const bg = decls['background'] || decls['background-image'] || '';
  return {
    progressTrack: validateGradient(bg),
    progressTrackShadow: validateBoxShadow(decls['box-shadow']),
  };
}

function extractProgressThumb(rules) {
  const candidates = rules.filter((rule) => {
    const sel = String(rule.selector || '').toLowerCase();
    return sel.includes('slider-thumb') || sel.includes('slider thumb');
  });
  let chosen = candidates.find((rule) => /playback|progress/.test(String(rule.selector || '').toLowerCase()));
  if (!chosen) chosen = candidates[0];
  if (!chosen) return { progressThumb: null, progressThumbShadow: null };
  const decls = chosen.declarations || {};
  return {
    progressThumb: extractDataImageUrl(decls['background-image'] || decls['background']),
    progressThumbShadow: validateBoxShadow(decls['box-shadow']),
  };
}

function extractCard(rules) {
  const candidates = rules.filter((rule) => {
    const sel = String(rule.selector || '').toLowerCase();
    if (sel.includes('::') || sel.includes(':hover') || sel.includes(':focus') || sel.includes(':active')) return false;
    return /\bcard\b/.test(sel) && !sel.includes('cardgrid') && !sel.includes('card-grid');
  });
  const merged = mergeDeclarations(candidates);
  return {
    cardBackground: validateBackgroundValue(merged['background'] || merged['background-image'] || merged['background-color']),
    cardBorder: validateBorder(combineBorder(merged)),
    cardRadius: validateRadius(merged['border-radius']),
  };
}

function extractButtonRadius(rules) {
  const candidates = rules.filter((rule) => {
    const sel = String(rule.selector || '').toLowerCase();
    if (sel.includes(':hover') || sel.includes(':focus') || sel.includes(':active')) return false;
    return sel.includes('nav') && Boolean(rule.declarations && rule.declarations['border-radius']);
  });
  const merged = mergeDeclarations(candidates);
  return validateRadius(merged['border-radius']);
}

function extractScrollbar(rules) {
  const thumbCandidates = rules.filter((rule) => {
    const sel = String(rule.selector || '').toLowerCase();
    if (sel.includes(':hover')) return false;
    return sel.includes('scrollbar-thumb') || sel.includes('::-webkit-scrollbar-thumb');
  });
  const trackCandidates = rules.filter((rule) => {
    const sel = String(rule.selector || '').toLowerCase();
    if (sel.includes(':hover')) return false;
    return sel.includes('scrollbar-track') || sel.includes('::-webkit-scrollbar-track');
  });
  const thumbMerged = mergeDeclarations(thumbCandidates);
  const trackMerged = mergeDeclarations(trackCandidates);
  const bgValue = thumbMerged['background'] || thumbMerged['background-color'] || thumbMerged['background-image'];
  return {
    scrollbar: validateBackgroundValue(bgValue),
    scrollbarRadius: validateRadius(thumbMerged['border-radius']),
    scrollbarTrack: validateColor(trackMerged['background'] || trackMerged['background-color']),
  };
}

function extractArtwork(rules) {
  const candidates = rules.filter((rule) => {
    const sel = String(rule.selector || '').toLowerCase();
    if (sel.includes(':hover') || sel.includes(':focus') || sel.includes(':active')) return false;
    const hasImage = sel.includes('img') || sel.includes('image');
    const hasTarget = sel.includes('now-playing') || sel.includes('nowplaying') || sel.includes('coverart') || sel.includes('cover-art') || sel.includes('cover art');
    return hasImage && hasTarget;
  });
  const merged = mergeDeclarations(candidates);
  return {
    artworkBorder: validateBorder(combineBorder(merged)),
    artworkShadow: validateBoxShadow(merged['box-shadow']),
  };
}

function extractGlow(rules) {
  const beforeCandidates = rules.filter((rule) => String(rule.selector || '').toLowerCase().includes('body::before'));
  const afterCandidates = rules.filter((rule) => String(rule.selector || '').toLowerCase().includes('body::after'));
  const beforeMerged = mergeDeclarations(beforeCandidates);
  const afterMerged = mergeDeclarations(afterCandidates);
  const beforeBg = validateBackgroundGradient(beforeMerged['background'] || beforeMerged['background-image']);
  const afterBg = validateBackgroundGradient(afterMerged['background'] || afterMerged['background-image']);
  const layers = [beforeBg, afterBg].filter(Boolean);
  if (!layers.length) return null;
  return layers.join(', ');
}

function extractFonts(rules) {
  const bodyRules = rules.filter((rule) => {
    const s = String(rule.selector || '').toLowerCase().replace(/\s+/g, ' ');
    return /(^|,)\s*(html|body)\b/.test(s);
  });
  let font = null;
  for (const rule of bodyRules) {
    if (rule.declarations && rule.declarations['font-family']) {
      font = rule.declarations['font-family'];
    }
  }
  if (!font) {
    const fallback = rules.find((rule) => String(rule.selector || '').toLowerCase().includes('body') && rule.declarations && rule.declarations['font-family']);
    font = fallback ? fallback.declarations['font-family'] : null;
  }

  const subtitleRules = rules.filter((rule) => {
    const s = String(rule.selector || '').toLowerCase();
    return s.includes('subtitle') || s.includes('footer');
  });
  let subtitleFont = null;
  for (const rule of subtitleRules) {
    if (rule.declarations && rule.declarations['font-family']) {
      subtitleFont = rule.declarations['font-family'];
    }
  }

  return {
    font: validateFontFamily(font),
    subtitleFont: validateFontFamily(subtitleFont),
  };
}

function extractSkin(cssText) {
  const { rules } = parseCss(cssText);
  const fonts = extractFonts(rules);
  const play = extractPlay(rules);
  const progress = extractProgressTrack(rules);
  const thumb = extractProgressThumb(rules);
  const card = extractCard(rules);
  const buttonRadius = extractButtonRadius(rules);
  const scrollbar = extractScrollbar(rules);
  const artwork = extractArtwork(rules);
  const glow = extractGlow(rules);

  const skin = {};
  if (fonts.font) skin.font = fonts.font;
  if (fonts.subtitleFont) skin.subtitleFont = fonts.subtitleFont;
  if (play.playImage) skin.playImage = play.playImage;
  if (play.playBackground) skin.playBackground = play.playBackground;
  if (play.playBorder) skin.playBorder = play.playBorder;
  if (play.playShadow) skin.playShadow = play.playShadow;
  if (progress.progressTrack) skin.progressTrack = progress.progressTrack;
  if (progress.progressTrackShadow) skin.progressTrackShadow = progress.progressTrackShadow;
  if (thumb.progressThumb) skin.progressThumb = thumb.progressThumb;
  if (thumb.progressThumbShadow) skin.progressThumbShadow = thumb.progressThumbShadow;
  if (card.cardBackground) skin.cardBackground = card.cardBackground;
  if (card.cardBorder) skin.cardBorder = card.cardBorder;
  if (card.cardRadius) skin.cardRadius = card.cardRadius;
  if (buttonRadius) skin.buttonRadius = buttonRadius;
  if (scrollbar.scrollbar) skin.scrollbar = scrollbar.scrollbar;
  if (scrollbar.scrollbarRadius) skin.scrollbarRadius = scrollbar.scrollbarRadius;
  if (scrollbar.scrollbarTrack) skin.scrollbarTrack = scrollbar.scrollbarTrack;
  if (artwork.artworkBorder) skin.artworkBorder = artwork.artworkBorder;
  if (artwork.artworkShadow) skin.artworkShadow = artwork.artworkShadow;
  if (glow) skin.glow = glow;

  return skin;
}

/* ---------- theme readers ---------- */

function themeDirsForName(appDataDir, localAppDataDir, themeName) {
  return [
    appDataDir ? path.join(appDataDir, 'spicetify', 'Themes', themeName) : null,
    localAppDataDir
      ? path.join(localAppDataDir, 'spicetify', 'Themes', themeName)
      : null,
  ].filter(Boolean);
}

function readThemeSkin(themeDir) {
  if (!themeDir) return null;

  let cssFileName = 'user.css';
  const manifest = readJson(path.join(themeDir, 'manifest.json'));
  if (manifest && typeof manifest.usercss === 'string' && manifest.usercss.trim()) {
    cssFileName = manifest.usercss.trim();
  }

  const text = readText(path.join(themeDir, cssFileName));
  if (!text) return null;

  const skin = extractSkin(text);
  return Object.keys(skin).length ? skin : null;
}

function readAppliedTheme(appDataDir, localAppDataDir) {
  if (!appDataDir) return null;
  const filePath = path.join(
    appDataDir,
    'Spotify',
    'Apps',
    'xpui',
    'spicetify-config.json',
  );
  const data = readJson(filePath);
  if (!data || typeof data !== 'object') return null;

  const schemes = data.schemes && typeof data.schemes === 'object' ? data.schemes : {};
  const requested = data.scheme_name || data.scheme || '';
  const section = findSection(schemes, requested);
  if (!section) return null;

  const palette = paletteFromColors(section.values, {
    source: 'spicetify',
    themeName: data.theme_name || data.theme || '',
    schemeName: section.name,
  });
  if (!palette) return null;

  for (const dir of themeDirsForName(appDataDir, localAppDataDir, palette.themeName)) {
    const skin = readThemeSkin(dir);
    if (skin) {
      palette.skin = skin;
      return palette;
    }
  }
  palette.skin = null;
  return palette;
}

function readConfiguredTheme(appDataDir, localAppDataDir) {
  if (!appDataDir) return null;

  const configPath = path.join(appDataDir, 'spicetify', 'config-xpui.ini');
  const configText = readText(configPath);
  if (!configText) return null;

  const config = parseIni(configText);
  const setting = config.Setting || {};
  const themeName = setting.current_theme;
  if (!themeName || setting.inject_css === '0') return null;

  const themeDirs = [
    path.join(appDataDir, 'spicetify', 'Themes', themeName),
    localAppDataDir
      ? path.join(localAppDataDir, 'spicetify', 'Themes', themeName)
      : null,
  ].filter(Boolean);

  for (const themeDir of themeDirs) {
    const colorText = readText(path.join(themeDir, 'color.ini'));
    if (!colorText) continue;

    const section = findSection(parseIni(colorText), setting.color_scheme);
    if (!section) continue;

    const palette = paletteFromColors(section.values, {
      source: 'spicetify',
      themeName,
      schemeName: section.name,
    });
    if (palette) {
      palette.skin = readThemeSkin(themeDir);
      return palette;
    }
  }

  return null;
}

function createSpotifyThemeReader(options = {}) {
  const appDataDir = options.appDataDir || process.env.APPDATA || '';
  const localAppDataDir = options.localAppDataDir || process.env.LOCALAPPDATA || '';

  return {
    read() {
      return (
        readAppliedTheme(appDataDir, localAppDataDir) ||
        readConfiguredTheme(appDataDir, localAppDataDir) ||
        null
      );
    },
  };
}

module.exports = {
  createSpotifyThemeReader,
  normalizeHex,
  paletteFromColors,
  parseIni,
  relativeLuminance,
  extractSkin,
  readThemeSkin,
};
