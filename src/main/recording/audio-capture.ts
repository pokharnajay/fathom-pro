/**
 * Audio capture module.
 *
 * Audio capture uses Web APIs (desktopCapturer, getUserMedia, MediaRecorder)
 * which only work in a renderer process. The main process orchestrates via IPC:
 *
 * 1. Main creates/reuses a hidden capture BrowserWindow
 * 2. Main sends 'capture:start' to it with config
 * 3. The capture window runs MediaRecorder on both streams
 * 4. Audio data chunks are sent back via IPC to main for disk writes
 * 5. Main sends 'capture:stop' to finalize
 *
 * This module provides the capture window HTML/JS as inline code
 * loaded via a data: URL to avoid extra build targets.
 */

import { BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { createWriteStream, WriteStream } from 'fs'
import log from '../utils/logger'

let captureWindow: BrowserWindow | null = null
let systemStream: WriteStream | null = null
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

  // Load the capture page
  captureWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(getCaptureHTML())}`)

  captureWindow.on('closed', () => {
    captureWindow = null
  })

  return captureWindow
}

export function startCapture(
  outputDir: string,
  micDeviceId?: string
): void {
  const win = createCaptureWindow()

  systemStream = createWriteStream(join(outputDir, 'audio_system.webm'))
  micStream = createWriteStream(join(outputDir, 'audio_mic.webm'))

  // Listen for audio data chunks from the capture window
  ipcMain.removeAllListeners('capture:system-data')
  ipcMain.removeAllListeners('capture:mic-data')
  ipcMain.removeAllListeners('capture:error')
  ipcMain.removeAllListeners('capture:levels')

  ipcMain.on('capture:system-data', (_event, buffer: Buffer) => {
    systemStream?.write(buffer)
  })

  ipcMain.on('capture:mic-data', (_event, buffer: Buffer) => {
    micStream?.write(buffer)
  })

  ipcMain.on('capture:error', (_event, error: string) => {
    log.error('Capture error:', error)
  })

  win.webContents.send('capture:start', { micDeviceId: micDeviceId || 'default' })
}

export function stopCapture(): Promise<void> {
  return new Promise((resolve) => {
    if (captureWindow && !captureWindow.isDestroyed()) {
      ipcMain.once('capture:stopped', () => {
        closeStreams()
        resolve()
      })
      captureWindow.webContents.send('capture:stop')

      // Timeout safety
      setTimeout(() => {
        closeStreams()
        resolve()
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
  if (systemStream) {
    systemStream.end()
    systemStream = null
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
const { ipcRenderer } = require('electron');

let systemRecorder = null;
let micRecorder = null;
let systemMediaStream = null;
let micMediaStream = null;
let audioContext = null;
let systemAnalyser = null;
let micAnalyser = null;
let levelsInterval = null;

// Listen for capture commands from main process
window.addEventListener('message', (event) => {
  // Not used with preload bridge
});

// Use IPC from preload
if (window.api) {
  window.api.onCaptureStart(async (config) => {
    try {
      await startCapture(config);
    } catch(e) {
      window.api.sendCaptureError(e.message);
    }
  });

  window.api.onCaptureStop(() => {
    stopCapture();
  });

  window.api.onCapturePause(() => {
    if (systemRecorder?.state === 'recording') systemRecorder.pause();
    if (micRecorder?.state === 'recording') micRecorder.pause();
  });

  window.api.onCaptureResume(() => {
    if (systemRecorder?.state === 'paused') systemRecorder.resume();
    if (micRecorder?.state === 'paused') micRecorder.resume();
  });
}

async function startCapture(config) {
  // Get system audio via desktopCapturer
  // In Electron, we use getDisplayMedia for system audio
  systemMediaStream = await navigator.mediaDevices.getDisplayMedia({
    audio: true,
    video: { width: 1, height: 1 } // minimal video (required to get audio)
  });

  // Remove video track, we only want audio
  systemMediaStream.getVideoTracks().forEach(t => t.stop());

  // Get microphone audio
  const micConstraints = { audio: config.micDeviceId && config.micDeviceId !== 'default'
    ? { deviceId: { exact: config.micDeviceId } }
    : true
  };
  micMediaStream = await navigator.mediaDevices.getUserMedia(micConstraints);

  // Set up audio analysis for levels
  audioContext = new AudioContext();

  const systemSource = audioContext.createMediaStreamSource(systemMediaStream);
  systemAnalyser = audioContext.createAnalyser();
  systemAnalyser.fftSize = 256;
  systemSource.connect(systemAnalyser);

  const micSource = audioContext.createMediaStreamSource(micMediaStream);
  micAnalyser = audioContext.createAnalyser();
  micAnalyser.fftSize = 256;
  micSource.connect(micAnalyser);

  // Send audio levels at ~15fps
  levelsInterval = setInterval(() => {
    const systemLevel = getAudioLevel(systemAnalyser);
    const micLevel = getAudioLevel(micAnalyser);
    if (window.api) {
      window.api.sendLevels({ system: systemLevel, mic: micLevel });
    }
  }, 66);

  // Start recording system audio
  systemRecorder = new MediaRecorder(systemMediaStream, {
    mimeType: 'audio/webm;codecs=opus'
  });
  systemRecorder.ondataavailable = (e) => {
    if (e.data.size > 0 && window.api) {
      e.data.arrayBuffer().then(buf => {
        window.api.sendSystemData(new Uint8Array(buf));
      });
    }
  };
  systemRecorder.start(1000); // 1 second chunks

  // Start recording mic
  micRecorder = new MediaRecorder(micMediaStream, {
    mimeType: 'audio/webm;codecs=opus'
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

  if (systemRecorder && systemRecorder.state !== 'inactive') {
    systemRecorder.stop();
  }
  if (micRecorder && micRecorder.state !== 'inactive') {
    micRecorder.stop();
  }

  if (systemMediaStream) {
    systemMediaStream.getTracks().forEach(t => t.stop());
  }
  if (micMediaStream) {
    micMediaStream.getTracks().forEach(t => t.stop());
  }

  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }

  if (window.api) {
    window.api.sendCaptureStopped();
  }
}

function getAudioLevel(analyser) {
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i];
  }
  return sum / data.length / 255; // Normalize 0-1
}
</script>
</body>
</html>`
}
