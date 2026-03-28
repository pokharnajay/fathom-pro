import { systemPreferences, dialog } from 'electron'
import log from '../utils/logger'

export interface PermissionStatus {
  microphone: 'granted' | 'denied' | 'not-determined'
  screen: 'granted' | 'denied' | 'not-determined'
}

export async function checkPermissions(): Promise<PermissionStatus> {
  const mic = systemPreferences.getMediaAccessStatus('microphone') as PermissionStatus['microphone']
  const screen = systemPreferences.getMediaAccessStatus('screen') as PermissionStatus['screen']

  return { microphone: mic, screen }
}

export async function requestPermissions(): Promise<PermissionStatus> {
  // Request microphone access (this triggers the OS prompt)
  let micStatus = systemPreferences.getMediaAccessStatus('microphone')
  if (micStatus === 'not-determined') {
    const granted = await systemPreferences.askForMediaAccess('microphone')
    micStatus = granted ? 'granted' : 'denied'
  }

  // Screen recording cannot be requested programmatically on macOS
  // We can only check the status and guide the user
  const screenStatus = systemPreferences.getMediaAccessStatus('screen')
  if (screenStatus !== 'granted') {
    log.warn('Screen recording permission not granted')
    dialog.showMessageBox({
      type: 'info',
      title: 'Screen Recording Permission Required',
      message: 'MeetRec needs Screen Recording permission to capture meeting audio.',
      detail: 'Please go to System Settings > Privacy & Security > Screen Recording and enable MeetRec.',
      buttons: ['Open System Settings', 'Later']
    }).then((result) => {
      if (result.response === 0) {
        const { shell } = require('electron')
        shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture')
      }
    })
  }

  return {
    microphone: micStatus as PermissionStatus['microphone'],
    screen: screenStatus as PermissionStatus['screen']
  }
}
