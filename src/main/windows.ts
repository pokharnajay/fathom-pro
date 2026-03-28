import { BrowserWindow, shell, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

let libraryWindow: BrowserWindow | null = null
let overlayWindow: BrowserWindow | null = null
let preferencesWindow: BrowserWindow | null = null

function getPreloadPath(): string {
  return join(__dirname, '../preload/index.js')
}

function getRendererURL(hash: string): string {
  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    return `${process.env.ELECTRON_RENDERER_URL}#${hash}`
  }
  return `file://${join(__dirname, '../renderer/index.html')}#${hash}`
}

export function createLibraryWindow(): BrowserWindow {
  if (libraryWindow && !libraryWindow.isDestroyed()) {
    libraryWindow.show()
    libraryWindow.focus()
    return libraryWindow
  }

  libraryWindow = new BrowserWindow({
    width: 1100,
    height: 700,
    minWidth: 800,
    minHeight: 500,
    title: 'MeetRec',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 },
    vibrancy: 'sidebar',
    show: false,
    webPreferences: {
      preload: getPreloadPath(),
      sandbox: false,
      webSecurity: false // Allow file:// URLs for audio playback
    }
  })

  libraryWindow.loadURL(getRendererURL('/library'))

  libraryWindow.on('ready-to-show', () => {
    libraryWindow?.show()
  })

  libraryWindow.on('closed', () => {
    libraryWindow = null
  })

  // Open external links in browser
  libraryWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  return libraryWindow
}

export function createOverlayWindow(): BrowserWindow {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.show()
    return overlayWindow
  }

  const display = screen.getPrimaryDisplay()
  const { width } = display.workAreaSize

  overlayWindow = new BrowserWindow({
    width: 300,
    height: 64,
    x: Math.round(width / 2 - 150),
    y: 10,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    movable: true,
    hasShadow: true,
    skipTaskbar: true,
    focusable: false,
    visibleOnAllWorkspaces: true,
    webPreferences: {
      preload: getPreloadPath(),
      sandbox: false
    }
  })

  overlayWindow.loadURL(getRendererURL('/overlay'))
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  overlayWindow.on('closed', () => {
    overlayWindow = null
  })

  return overlayWindow
}

export function closeOverlayWindow(): void {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.close()
  }
  overlayWindow = null
}

export function createPreferencesWindow(): BrowserWindow {
  if (preferencesWindow && !preferencesWindow.isDestroyed()) {
    preferencesWindow.show()
    preferencesWindow.focus()
    return preferencesWindow
  }

  preferencesWindow = new BrowserWindow({
    width: 550,
    height: 520,
    title: 'MeetRec Preferences',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 },
    resizable: false,
    minimizable: false,
    maximizable: false,
    show: false,
    webPreferences: {
      preload: getPreloadPath(),
      sandbox: false
    }
  })

  preferencesWindow.loadURL(getRendererURL('/preferences'))

  preferencesWindow.on('ready-to-show', () => {
    preferencesWindow?.show()
  })

  preferencesWindow.on('closed', () => {
    preferencesWindow = null
  })

  return preferencesWindow
}

export function getLibraryWindow(): BrowserWindow | null {
  return libraryWindow && !libraryWindow.isDestroyed() ? libraryWindow : null
}

export function getOverlayWindow(): BrowserWindow | null {
  return overlayWindow && !overlayWindow.isDestroyed() ? overlayWindow : null
}

export function sendToAllWindows(channel: string, ...args: unknown[]): void {
  const windows = [libraryWindow, overlayWindow, preferencesWindow]
  for (const win of windows) {
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, ...args)
    }
  }
}
