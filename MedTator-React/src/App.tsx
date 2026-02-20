import { useEffect } from 'react'
import { useAppStore } from './store'
import RibbonMenu from './components/RibbonMenu'
import Annotation from './components/Annotation'
import Statistics from './components/Statistics'
import Export from './components/Export'
import Adjudication from './components/Adjudication'
import Converter from './components/Converter'
import Toolkit from './components/Toolkit'

const tabComponents = {
  annotation: Annotation,
  statistics: Statistics,
  export: Export,
  adjudication: Adjudication,
  converter: Converter,
  toolkit: Toolkit,
}

function App() {
  const currentTab = useAppStore((s) => s.currentTab)
  const TabContent = tabComponents[currentTab]

  // Warn before unload if there are unsaved annotation files
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      const hasUnsaved = useAppStore.getState().anns.some(a => !a._has_saved)
      if (hasUnsaved) {
        e.preventDefault()
        e.returnValue = 'There are unsaved annotation files. Are you sure you want to leave?'
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <RibbonMenu />
      <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
        <TabContent />
      </div>
    </div>
  )
}

export default App
