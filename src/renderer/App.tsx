import { useState, useEffect } from 'react'
import LibraryView from './components/library/LibraryView'
import OverlayView from './components/overlay/OverlayView'
import PreferencesView from './components/preferences/PreferencesView'

function getRoute(): string {
  const hash = window.location.hash.replace('#', '') || '/library'
  return hash
}

export default function App() {
  const [route, setRoute] = useState(getRoute)

  useEffect(() => {
    const onHashChange = () => setRoute(getRoute())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  switch (route) {
    case '/overlay':
      return <OverlayView />
    case '/preferences':
      return <PreferencesView />
    case '/library':
    default:
      return <LibraryView />
  }
}
