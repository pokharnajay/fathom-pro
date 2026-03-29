import { Tray, Menu, nativeImage, app } from 'electron'
import { join } from 'path'
import { createLibraryWindow, createPreferencesWindow } from './windows'
import { recordingEngine } from './recording/engine'
import { getRecentRecordings } from './db/recordings-repo'
import type { RecordingState } from './utils/constants'

let tray: Tray | null = null

export function createTray(): Tray {
  // Create a simple template image for the menu bar
  const icon = createTrayIcon('idle')
  tray = new Tray(icon)
  tray.setToolTip('MeetRec')

  updateTrayMenu()

  // Update tray when recording state changes
  recordingEngine.on('state-change', (state: RecordingState) => {
    if (tray) {
      tray.setImage(createTrayIcon(state))
      updateTrayMenu()
    }
  })

  // Update timer in tooltip
  recordingEngine.on('timer', (seconds: number) => {
    if (tray) {
      const m = Math.floor(seconds / 60)
      const s = seconds % 60
      tray.setToolTip(`MeetRec — Recording ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`)
    }
  })

  return tray
}

function updateTrayMenu(): void {
  if (!tray) return

  const state = recordingEngine.state
  const isRecording = state === 'recording' || state === 'paused'

  const recentRecordings = getRecentRecordings(5)
  const recentItems: Electron.MenuItemConstructorOptions[] = recentRecordings.map((rec) => ({
    label: rec.title || rec.id,
    click: () => {
      const win = createLibraryWindow()
      win.webContents.send('navigate-recording', rec.id)
    }
  }))

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: isRecording ? 'Stop Recording' : 'Start Recording',
      click: async () => {
        if (isRecording) {
          await recordingEngine.stop()
          recordingEngine.reset()
        } else {
          const { getConfig } = require('./storage/config')
          const config = getConfig()
          await recordingEngine.start({
            quality: config.recording.quality,
            recordScreen: config.recording.recordScreen,
            micDeviceId: config.recording.micDeviceId
          })
        }
        updateTrayMenu()
      }
    },
    ...(state === 'recording'
      ? [
          {
            label: 'Pause Recording',
            click: () => {
              recordingEngine.pause()
              updateTrayMenu()
            }
          }
        ]
      : []),
    ...(state === 'paused'
      ? [
          {
            label: 'Resume Recording',
            click: () => {
              recordingEngine.resume()
              updateTrayMenu()
            }
          }
        ]
      : []),
    { type: 'separator' as const },
    {
      label: 'Recent Recordings',
      submenu:
        recentItems.length > 0
          ? recentItems
          : [{ label: 'No recordings yet', enabled: false }]
    },
    { type: 'separator' as const },
    {
      label: 'Open Library',
      accelerator: 'Alt+Shift+L',
      click: () => createLibraryWindow()
    },
    {
      label: 'Preferences...',
      click: () => createPreferencesWindow()
    },
    { type: 'separator' as const },
    {
      label: 'Quit MeetRec',
      click: () => app.quit()
    }
  ]

  tray.setContextMenu(Menu.buildFromTemplate(template))
}

function createTrayIcon(state: RecordingState | string): Electron.NativeImage {
  // Create a 22x22 icon programmatically (template image for macOS)
  const size = 22
  const canvas = Buffer.alloc(size * size * 4) // RGBA

  if (state === 'recording') {
    // Red dot
    drawCircle(canvas, size, size / 2, size / 2, 8, 255, 59, 48, 255)
  } else if (state === 'paused') {
    // Orange dot
    drawCircle(canvas, size, size / 2, size / 2, 8, 255, 149, 0, 255)
  } else if (state === 'processing') {
    // Blue dot
    drawCircle(canvas, size, size / 2, size / 2, 8, 0, 122, 255, 255)
  } else {
    // Grey dot (idle)
    drawCircle(canvas, size, size / 2, size / 2, 8, 142, 142, 147, 255)
  }

  return nativeImage.createFromBuffer(canvas, {
    width: size,
    height: size,
    scaleFactor: 1
  })
}

function drawCircle(
  buf: Buffer,
  imageSize: number,
  cx: number,
  cy: number,
  r: number,
  red: number,
  green: number,
  blue: number,
  alpha: number
): void {
  for (let y = 0; y < imageSize; y++) {
    for (let x = 0; x < imageSize; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
      if (dist <= r) {
        const idx = (y * imageSize + x) * 4
        buf[idx] = red
        buf[idx + 1] = green
        buf[idx + 2] = blue
        buf[idx + 3] = alpha
      }
    }
  }
}

export function getTray(): Tray | null {
  return tray
}
