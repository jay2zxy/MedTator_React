import { Menu } from 'antd'
import {
  HighlightOutlined,
  BarChartOutlined,
  ExportOutlined,
  TeamOutlined,
  ExperimentOutlined,
  BugOutlined,
  ToolOutlined,
} from '@ant-design/icons'
import { useAppStore } from '../store'
import type { TabKey } from '../store'

const menuItems = [
  { key: 'annotation', icon: <HighlightOutlined />, label: 'Annotation' },
  { key: 'statistics', icon: <BarChartOutlined />, label: 'Statistics' },
  { key: 'export', icon: <ExportOutlined />, label: 'Export' },
  { key: 'adjudication', icon: <TeamOutlined />, label: 'Adjudication' },
  { key: 'converter', icon: <ExperimentOutlined />, label: 'Converter' },
  { key: 'error-analysis', icon: <BugOutlined />, label: 'Error Analysis' },
  { key: 'toolkit', icon: <ToolOutlined />, label: 'Toolkit' },
]

export default function RibbonMenu() {
  const currentTab = useAppStore((s) => s.currentTab)
  const setCurrentTab = useAppStore((s) => s.setCurrentTab)

  return (
    <Menu
      mode="horizontal"
      selectedKeys={[currentTab]}
      onClick={({ key }) => setCurrentTab(key as TabKey)}
      items={menuItems}
      style={{ borderBottom: '1px solid #e8e8e8' }}
    />
  )
}
