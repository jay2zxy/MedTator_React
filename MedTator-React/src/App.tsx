import { useAppStore } from './store'
import RibbonMenu from './components/RibbonMenu'
import Annotation from './components/Annotation'
import Statistics from './components/Statistics'
import Export from './components/Export'
import Adjudication from './components/Adjudication'
import Converter from './components/Converter'
import ErrorAnalysis from './components/ErrorAnalysis'
import Toolkit from './components/Toolkit'

const tabComponents = {
  annotation: Annotation,
  statistics: Statistics,
  export: Export,
  adjudication: Adjudication,
  converter: Converter,
  'error-analysis': ErrorAnalysis,
  toolkit: Toolkit,
}

function App() {
  const currentTab = useAppStore((s) => s.currentTab)
  const TabContent = tabComponents[currentTab]

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
