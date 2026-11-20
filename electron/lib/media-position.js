'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');

// Windows exposes the media timeline through SMTC. spotify_cli has no position
// field, so this small helper fills the gap for the progress bar. It is only
// polled occasionally; the renderer extrapolates between samples.
const SCRIPT = `$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Runtime.WindowsRuntime

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1'
})[0]

function Await($operation, $resultType) {
  $task = $asTaskGeneric.MakeGenericMethod($resultType).Invoke($null, @($operation))
  $task.Wait(5000) | Out-Null
  return $task.Result
}

$managerType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
$manager = Await ($managerType::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
$sessions = @($manager.GetSessions() | Where-Object { $_.SourceAppUserModelId -match 'Spotify' })
$session = $sessions | Where-Object {
  $_.GetPlaybackInfo().PlaybackStatus.ToString() -eq 'Playing'
} | Select-Object -First 1
if ($null -eq $session) {
  $session = $sessions | Select-Object -First 1
}
if ($null -eq $session) {
  Write-Output '{"available":false}'
  exit 0
}

$timeline = $session.GetTimelineProperties()
$props = Await ($session.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
$info = $session.GetPlaybackInfo()

$result = [ordered]@{
  available = $true
  source = $session.SourceAppUserModelId
  title = $props.Title
  artist = $props.Artist
  positionMs = [math]::Round($timeline.Position.TotalMilliseconds)
  startMs = [math]::Round($timeline.StartTime.TotalMilliseconds)
  endMs = [math]::Round($timeline.EndTime.TotalMilliseconds)
  lastUpdated = $timeline.LastUpdatedTime.ToUnixTimeMilliseconds()
  playing = $info.PlaybackStatus.ToString()
}
$result | ConvertTo-Json -Compress
`;

function normalizeTitle(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function parseMediaSessionJson(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!data || data.available !== true) return null;
  if (!/spotify/i.test(String(data.source || ''))) return null;

  const positionMs = Number(data.positionMs);
  const startMs = Number(data.startMs) || 0;
  const endMs = Number(data.endMs);
  if (!Number.isFinite(positionMs)) return null;

  return {
    title: String(data.title || ''),
    artist: String(data.artist || ''),
    positionMs: Math.max(0, Math.round(positionMs)),
    durationMs: Number.isFinite(endMs) && endMs > startMs ? Math.round(endMs - startMs) : 0,
    playing: /playing/i.test(String(data.playing || '')),
  };
}

function createMediaPositionReader({ directory, logger = console, runPowerShell } = {}) {
  const scriptPath = path.join(directory, 'media-session.ps1');
  try {
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(scriptPath, SCRIPT, 'utf8');
  } catch (error) {
    logger.warn?.(`[media] Could not prepare the position helper: ${error.message}`);
  }

  const execute = runPowerShell || ((args) => new Promise((resolve, reject) => {
    execFile(
      'powershell',
      args,
      {
        windowsHide: true,
        timeout: 5000,
        maxBuffer: 1024 * 1024,
        encoding: 'utf8',
      },
      (error, stdout, stderr) => {
        if (error) reject(new Error(String(stderr || error.message || 'PowerShell failed')));
        else resolve(stdout);
      },
    );
  }));

  let cached = null;
  let cachedAt = 0;
  let pending = null;

  async function read() {
    const now = Date.now();
    if (cached && now - cachedAt < 1500) return cached;
    if (pending) return pending;

    pending = (async () => {
      try {
        const output = await execute([
          '-NoProfile',
          '-NonInteractive',
          '-ExecutionPolicy',
          'Bypass',
          '-File',
          scriptPath,
        ]);
        const parsed = parseMediaSessionJson(output);
        cached = parsed;
        cachedAt = Date.now();
        return parsed;
      } catch (error) {
        logger.warn?.(`[media] Could not read the Windows media timeline: ${error.message}`);
        cached = null;
        cachedAt = Date.now();
        return null;
      } finally {
        pending = null;
      }
    })();

    return pending;
  }

  return { read, scriptPath };
}

module.exports = {
  createMediaPositionReader,
  parseMediaSessionJson,
  normalizeTitle,
};
