import { Radio, Button, Switch, Select, Input, Divider } from 'antd'
import {
  SearchOutlined,
  ClearOutlined,
  SaveOutlined,
  FolderOpenOutlined,
  DeleteOutlined,
  TagOutlined,
  LinkOutlined,
  LeftOutlined,
  RightOutlined,
  CheckOutlined,
  StopOutlined,
  EditOutlined,
  ToolOutlined,
  InfoCircleOutlined,
  AppstoreOutlined,
} from '@ant-design/icons'

/* ── 工具栏 Ribbon ── */
function ToolbarRibbon() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'stretch',
      borderBottom: '1px solid #ccc',
      background: '#fafafa',
      minHeight: 70,
      fontSize: 12,
      flexWrap: 'wrap',
    }}>
      {/* Schema File */}
      <ToolbarGroup label="Schema File (.yaml / .json / .dtd)">
        <div style={{
          border: '2px dashed #d9d9d9',
          borderRadius: 4,
          padding: '4px 12px',
          textAlign: 'center',
          cursor: 'pointer',
          color: '#999',
          fontSize: 12,
          minWidth: 120,
        }}>
          Drop a <b>Schema</b> File Here
        </div>
      </ToolbarGroup>

      {/* Annotation File */}
      <ToolbarGroup label="Annotation File (.xml)">
        <div style={{ color: '#999', fontSize: 12 }}>
          &larr; Load schema file first
        </div>
      </ToolbarGroup>

      {/* Display Mode */}
      <ToolbarGroup label="Display Mode">
        <Radio.Group size="small" defaultValue="document">
          <Radio.Button value="document">Document</Radio.Button>
          <Radio.Button value="sentences">Sentences</Radio.Button>
        </Radio.Group>
        <Button size="small" style={{ marginLeft: 4 }}>Visualize</Button>
      </ToolbarGroup>

      {/* Search */}
      <ToolbarGroup label="Search">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Button size="small" icon={<SearchOutlined />}>Search</Button>
          <Button size="small" icon={<ClearOutlined />}>Clear</Button>
        </div>
      </ToolbarGroup>

      {/* Entity Marks */}
      <ToolbarGroup label="Entity Marks">
        <Radio.Group size="small" defaultValue="color-id">
          <Radio.Button value="color-id">Color + ID</Radio.Button>
          <Radio.Button value="color-only">Color Only</Radio.Button>
        </Radio.Group>
      </ToolbarGroup>

      {/* Link Marks */}
      <ToolbarGroup label="Link Marks">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Switch size="small" defaultChecked /> <span>Show Links</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Switch size="small" defaultChecked /> <span>Show Lines</span>
          </div>
        </div>
      </ToolbarGroup>

      {/* Hint Marks */}
      <ToolbarGroup label="Hint Marks">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <Radio.Group size="small" defaultValue="no-hint">
            <Radio.Button value="simple-hint">Simple Hint</Radio.Button>
            <Radio.Button value="no-hint"><StopOutlined /> No Hint</Radio.Button>
          </Radio.Group>
          <Button size="small" icon={<CheckOutlined />}>Accept All</Button>
        </div>
      </ToolbarGroup>

      {/* Help */}
      <ToolbarGroup label="Help">
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
            <EditOutlined style={{ fontSize: 22 }} />
            <span style={{ fontSize: 10 }}>Sample</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
            <ToolOutlined style={{ fontSize: 22 }} />
            <span style={{ fontSize: 10 }}>Schema</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
            <InfoCircleOutlined style={{ fontSize: 22 }} />
            <span style={{ fontSize: 10 }}>Wiki</span>
          </div>
        </div>
      </ToolbarGroup>
    </div>
  )
}

function ToolbarGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '6px 10px',
      borderRight: '1px solid #e8e8e8',
      gap: 4,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
        {children}
      </div>
      <div style={{ fontSize: 10, color: '#888', whiteSpace: 'nowrap' }}>{label}</div>
    </div>
  )
}

/* ── 文件列表面板 ── */
function FileListPanel() {
  return (
    <div style={{ width: 250, minWidth: 250, display: 'flex', flexDirection: 'column', borderRight: '1px solid #e9e9e9' }}>
      {/* 工具栏 */}
      <div style={{
        height: 30,
        display: 'flex',
        alignItems: 'center',
        padding: '0 4px',
        borderBottom: '1px solid #e9e9e9',
        gap: 4,
        fontSize: 12,
      }}>
        <Select
          size="small"
          defaultValue="name-asc"
          style={{ width: 60 }}
          options={[
            { value: 'name-asc', label: 'Sort ↑' },
            { value: 'name-desc', label: 'Sort ↓' },
          ]}
        />
        <span style={{ color: '#888' }}>Filter:</span>
        <Input size="small" style={{ flex: 1 }} allowClear />
        <Button size="small" type="text" style={{ fontSize: 11 }}>All</Button>
      </div>

      {/* 文件列表 */}
      <div style={{ flex: 1, overflow: 'auto', padding: 4 }}>
        <div style={{ color: '#999', fontSize: 12, textAlign: 'center', marginTop: 40 }}>
          <FolderOpenOutlined style={{ fontSize: 24, display: 'block', marginBottom: 8 }} />
          Load schema file first<br />
          Drop a .yaml or .dtd File Here
        </div>
      </div>

      {/* 分页 */}
      <div style={{
        height: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderTop: '1px solid #e9e9e9',
        gap: 4,
        fontSize: 12,
      }}>
        <Button size="small" icon={<LeftOutlined />} disabled />
        <span style={{ color: '#888' }}>0 files</span>
        <Button size="small" icon={<RightOutlined />} disabled />
      </div>
    </div>
  )
}

/* ── 编辑器面板 ── */
function EditorPanel() {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'monospace',
      fontSize: 13,
      position: 'relative',
    }}>
      {/* 行号 + 编辑区域（模拟 CodeMirror） */}
      <div style={{ flex: 1, display: 'flex', overflow: 'auto' }}>
        <div style={{
          width: 40,
          background: '#f7f7f7',
          borderRight: '1px solid #ddd',
          textAlign: 'right',
          padding: '4px 4px',
          color: '#999',
          userSelect: 'none',
        }}>
          1
        </div>
        <div style={{ flex: 1, padding: 4, outline: 'none', minHeight: '100%' }} />
      </div>
    </div>
  )
}

/* ── Tag 定义列表 ── */
function TagListPanel() {
  return (
    <div style={{ width: 250, minWidth: 250, display: 'flex', flexDirection: 'column', borderRight: '1px solid #e9e9e9' }}>
      <div style={{
        padding: '4px 8px',
        background: '#fafafa',
        borderBottom: '1px solid #e9e9e9',
        fontSize: 12,
        fontWeight: 'bold',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}>
        <FolderOpenOutlined /> All Tags <span style={{ marginLeft: 'auto', color: '#888' }}>0</span>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 4 }}>
        <div style={{ color: '#ccc', fontSize: 12, textAlign: 'center', marginTop: 20 }}>
          <TagOutlined style={{ fontSize: 20, display: 'block', marginBottom: 4 }} />
          Entity Tags
        </div>
        <Divider style={{ margin: '8px 0', fontSize: 11 }} />
        <div style={{ color: '#ccc', fontSize: 12, textAlign: 'center' }}>
          <LinkOutlined style={{ fontSize: 20, display: 'block', marginBottom: 4 }} />
          Link Tags
        </div>
      </div>
    </div>
  )
}

/* ── 标注表格 ── */
function AnnotationTable() {
  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#fafafa', borderBottom: '1px solid #e9e9e9' }}>
            <th style={{ textAlign: 'left', padding: '4px 8px', width: 140 }}>Tag</th>
            <th style={{ textAlign: 'left', padding: '4px 8px', width: 50 }}>ID</th>
            <th style={{ textAlign: 'left', padding: '4px 8px', width: 120 }}>Spans</th>
            <th style={{ textAlign: 'left', padding: '4px 8px', width: 100 }}>Text</th>
            <th style={{ textAlign: 'left', padding: '4px 8px' }}>Attributes</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={5} style={{ textAlign: 'center', padding: 20, color: '#ccc' }}>
              No annotations loaded
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

/* ── 主组件 ── */
export default function Annotation() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 工具栏 */}
      <ToolbarRibbon />

      {/* 上半区: 文件列表 + 编辑器 (60%) */}
      <div style={{ flex: 6, display: 'flex', minHeight: 0, borderBottom: '5px solid #e9e9e9' }}>
        <FileListPanel />
        <EditorPanel />
      </div>

      {/* 下半区: Tag列表 + 标注表格 (40%) */}
      <div style={{ flex: 4, display: 'flex', minHeight: 0 }}>
        <TagListPanel />
        <AnnotationTable />
      </div>
    </div>
  )
}
