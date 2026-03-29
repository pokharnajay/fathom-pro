import { app, globalShortcut, BrowserWindow, Notification } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { createTray } from './tray'
import { createLibraryWindow } from './windows'
import { registerIpcHandlers } from './ipc-handlers'
import { getStoragePath } from './storage/file-manager'
import { getConfig } from './storage/config'
import { getDb, closeDb } from './db/database'
import { recordingEngine } from './recording/engine'
import log from './utils/logger'

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
}

app.on('second-instance', () => {
  createLibraryWindow()
})

app.whenReady().then(() => {
  log.info('MeetRec starting...')

  // Set app user model id for Windows (no-op on macOS but good practice)
  electronApp.setAppUserModelId('com.meetrec.app')

  // Initialize storage
  getStoragePath()
  log.info('Storage path:', getStoragePath())

  // Initialize database
  getDb()
  log.info('Database initialized')

  // Register IPC handlers
  registerIpcHandlers()

  // Create tray
  createTray()
  log.info('Tray created')

  // Hide dock icon by default (menu bar app)
  if (process.platform === 'darwin') {
    app.dock?.hide()
  }

  // Register global shortcuts
  const config = getConfig()
  try {
    globalShortcut.register(config.shortcuts.toggleRecording, async () => {
      const state = recordingEngine.state
      if (state === 'recording' || state === 'paused') {
        await recordingEngine.stop()
        recordingEngine.reset()
      } else if (state === 'idle' || state === 'done') {
        await recordingEngine.start({
          quality: config.recording.quality,
          recordScreen: config.recording.recordScreen,
          micDeviceId: config.recording.micDeviceId
        })
      }
    })
  } catch {
    log.warn('Failed to register toggle recording shortcut')
  }

  try {
    globalShortcut.register(config.shortcuts.openLibrary, () => {
      createLibraryWindow()
      app.dock?.show()
    })
  } catch {
    log.warn('Failed to register open library shortcut')
  }

  // Optimize browser window handling
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Show dock when a window is open
  app.on('browser-window-focus', () => {
    app.dock?.show()
  })

  // macOS: re-create window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createLibraryWindow()
    }
  })

  log.info('MeetRec ready')
})

app.on('window-all-closed', () => {
  // Keep running in menu bar (don't quit when all windows close)
  if (process.platform === 'darwin') {
    app.dock?.hide()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  closeDb()
  log.info('MeetRec shutting down')
})
