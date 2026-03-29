/**
 * Audio + Video capture module.
 *
 * Uses getDisplayMedia with tab capture to record ONLY the selected
 * browser tab (Google Meet) at 1080p 30fps + that tab's audio.
 * Mic is captured separately via getUserMedia.
 *
 * The user picks the Meet tab via the browser's native tab picker.
 * This ensures we capture ONLY Meet's audio — not Spotify, notifications, etc.
 */

import { BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { createWriteStream, WriteStream } from 'fs'
import log from '../utils/logger'

let captureWindow: BrowserWindow | null = null
let tabStream: WriteStream | null = null
let micStream: WriteStream | null = null

export function createCaptureWindow(): BrowserWindow {
  if (captureWindow && !captureWindow.isDestroyed()) {
    return captureWindow
  }

  captureWindow = new BrowserWindow({
    show: false,
    width: 1,
    height: 1,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, '../preload/index.js')
    }
  })

  captureWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(getCaptureHTML())}`)

  captureWindow.on('closed', () => {
    captureWindow = null
  })

  return captureWindow
}

export function startCapture(
  outputDir: string,
  recordScreen: boolean,
  micDeviceId?: string
): void {
  const win = createCaptureWindow()

  // Tab capture = video (1080p) + tab audio in one file
  const videoExt = recordScreen ? 'webm' : 'webm'
  tabStream = createWriteStream(join(outputDir, `tab_capture.${videoExt}`))
  micStream = createWriteStream(join(outputDir, 'audio_mic.webm'))

  ipcMain.removeAllListeners('capture:tab-data')
  ipcMain.removeAllListeners('capture:mic-data')
  ipcMain.removeAllListeners('capture:error')
  ipcMain.removeAllListeners('capture:levels')

  ipcMain.on('capture:tab-data', (_event, buffer: Buffer) => {
    tabStream?.write(buffer)
  })

  ipcMain.on('capture:mic-data', (_event, buffer: Buffer) => {
    micStream?.write(buffer)
  })

  ipcMain.on('capture:error', (_event, error: string) => {
    log.error('Capture error:', error)
  })

  win.webContents.send('capture:start', {
    micDeviceId: micDeviceId || 'default',
    recordScreen
  })
}

export function stopCapture(): Promise<void> {
  return new Promise((resolve) => {
    if (captureWindow && !captureWindow.isDestroyed()) {
      let resolved = false
      ipcMain.once('capture:stopped', () => {
        if (!resolved) {
          resolved = true
          closeStreams()
          resolve()
        }
      })
      captureWindow.webContents.send('capture:stop')

      setTimeout(() => {
        if (!resolved) {
          resolved = true
          closeStreams()
          resolve()
        }
      }, 3000)
    } else {
      closeStreams()
      resolve()
    }
  })
}

export function pauseCapture(): void {
  if (captureWindow && !captureWindow.isDestroyed()) {
    captureWindow.webContents.send('capture:pause')
  }
}

export function resumeCapture(): void {
  if (captureWindow && !captureWindow.isDestroyed()) {
    captureWindow.webContents.send('capture:resume')
  }
}

export function destroyCaptureWindow(): void {
  if (captureWindow && !captureWindow.isDestroyed()) {
    captureWindow.close()
  }
  captureWindow = null
}

function closeStreams(): void {
  if (tabStream) {
    tabStream.end()
    tabStream = null
  }
  if (micStream) {
    micStream.end()
    micStream = null
  }
}

function getCaptureHTML(): string {
  return `<!DOCTYPE html>
<html>
<head><title>MeetRec Capture</title></head>
<body>
<script>
let tabRecorder = null;
let micRecorder = null;
let tabMediaStream = null;
let micMediaStream = null;
let audioContext = null;
let tabAnalyser = null;
let micAnalyser = null;
let levelsInterval = null;

if (window.api) {
  window.api.onCaptureStart(async (config) => {
    try {
      await startCapture(config);
    } catch(e) {
      window.api.sendCaptureError(e.message);
    }
  });

  window.api.onCaptureStop(() => stopCapture());

  window.api.onCapturePause(() => {
    if (tabRecorder?.state === 'recording') tabRecorder.pause();
    if (micRecorder?.state === 'recording') micRecorder.pause();
  });

  window.api.onCaptureResume(() => {
    if (tabRecorder?.state === 'paused') tabRecorder.resume();
    if (micRecorder?.state === 'paused') micRecorder.resume();
  });
}

async function startCapture(config) {
  // ── Tab capture: video (1080p 30fps) + ONLY that tab's audio ──
  // getDisplayMedia with preferCurrentTab asks user to pick a Chrome tab.
  // When "Share tab audio" is checked, we get ONLY that tab's audio stream.
  // This is the key: no system audio, no Spotify, just Meet.
  const displayConstraints = {
    video: config.recordScreen ? {
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      frameRate: { ideal: 30, max: 30 },
      displaySurface: 'browser'     // Prefer tab capture
    } : {
      width: { ideal: 1 },
      height: { ideal: 1 },
      displaySurface: 'browser'
    },
    audio: {
      // Tab audio capture — captures ONLY the selected tab's audio
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      sampleRate: 48000
    },
    // Hint to prefer tab selection over full screen
    preferCurrentTab: false,
    selfBrowserSurface: 'exclude',
    surfaceSwitching: 'exclude',
    systemAudio: 'exclude'          // Exclude system audio, only tab audio
  };

  tabMediaStream = await navigator.mediaDevices.getDisplayMedia(displayConstraints);

  // If user chose NOT to record video, remove video track
  if (!config.recordScreen) {
    tabMediaStream.getVideoTracks().forEach(t => t.stop());
  }

  // ── Mic capture (separate track) ──
  const micConstraints = {
    audio: config.micDeviceId && config.micDeviceId !== 'default'
      ? { deviceId: { exact: config.micDeviceId }, echoCancellation: true, noiseSuppression: true }
      : { echoCancellation: true, noiseSuppression: true }
  };
  micMediaStream = await navigator.mediaDevices.getUserMedia(micConstraints);

  // ── Audio analysis for level meters ──
  audioContext = new AudioContext();

  // Tab audio levels
  const tabAudioTracks = tabMediaStream.getAudioTracks();
  if (tabAudioTracks.length > 0) {
    const tabAudioStream = new MediaStream(tabAudioTracks);
    const tabSource = audioContext.createMediaStreamSource(tabAudioStream);
    tabAnalyser = audioContext.createAnalyser();
    tabAnalyser.fftSize = 256;
    tabSource.connect(tabAnalyser);
  }

  // Mic audio levels
  const micSource = audioContext.createMediaStreamSource(micMediaStream);
  micAnalyser = audioContext.createAnalyser();
  micAnalyser.fftSize = 256;
  micSource.connect(micAnalyser);

  // Send levels at ~15fps
  levelsInterval = setInterval(() => {
    const tabLevel = tabAnalyser ? getAudioLevel(tabAnalyser) : 0;
    const micLevel = getAudioLevel(micAnalyser);
    if (window.api) {
      window.api.sendLevels({ system: tabLevel, mic: micLevel });
    }
  }, 66);

  // ── Record tab stream (video + tab audio) ──
  // Use high-quality codec for crystal clear 1080p
  const tabMimeType = config.recordScreen
    ? 'video/webm;codecs=vp9,opus'    // VP9 for sharp 1080p video + Opus audio
    : 'audio/webm;codecs=opus';        // Audio-only if no screen recording

  tabRecorder = new MediaRecorder(tabMediaStream, {
    mimeType: tabMimeType,
    videoBitsPerSecond: config.recordScreen ? 6000000 : undefined,  // 6 Mbps for crisp 1080p
    audioBitsPerSecond: 256000     // 256 kbps audio for crystal clear quality
  });

  tabRecorder.ondataavailable = (e) => {
    if (e.data.size > 0 && window.api) {
      e.data.arrayBuffer().then(buf => {
        window.api.sendTabData(new Uint8Array(buf));
      });
    }
  };
  tabRecorder.start(1000);

  // ── Record mic (separate track for transcription) ──
  micRecorder = new MediaRecorder(micMediaStream, {
    mimeType: 'audio/webm;codecs=opus',
    audioBitsPerSecond: 256000
  });
  micRecorder.ondataavailable = (e) => {
    if (e.data.size > 0 && window.api) {
      e.data.arrayBuffer().then(buf => {
        window.api.sendMicData(new Uint8Array(buf));
      });
    }
  };
  micRecorder.start(1000);
}

function stopCapture() {
  if (levelsInterval) {
    clearInterval(levelsInterval);
    levelsInterval = null;
  }

  const promises = [];

  if (tabRecorder && tabRecorder.state !== 'inactive') {
    promises.push(new Promise(resolve => {
      tabRecorder.onstop = resolve;
      tabRecorder.stop();
    }));
  }
  if (micRecorder && micRecorder.state !== 'inactive') {
    promises.push(new Promise(resolve => {
      micRecorder.onstop = resolve;
      micRecorder.stop();
    }));
  }

  Promise.all(promises).then(() => {
    if (tabMediaStream) tabMediaStream.getTracks().forEach(t => t.stop());
    if (micMediaStream) micMediaStream.getTracks().forEach(t => t.stop());
    if (audioContext) { audioContext.close(); audioContext = null; }
    if (window.api) window.api.sendCaptureStopped();
  });
}

function getAudioLevel(analyser) {
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i];
  return sum / data.length / 255;
}
</script>
</body>
</html>`
}
