export default function Annotation() {
  return (
    <div style={{ display: 'flex', height: '100%', gap: 8 }}>
      <div style={{ width: 200, border: '1px solid #d9d9d9', padding: 8 }}>
        <b>File List</b>
        <p style={{ color: '#999' }}>Drop DTD + XML files here</p>
      </div>
      <div style={{ flex: 1, border: '1px solid #d9d9d9', padding: 8 }}>
        <b>Editor</b>
        <p style={{ color: '#999' }}>CodeMirror will go here</p>
      </div>
      <div style={{ width: 300, border: '1px solid #d9d9d9', padding: 8 }}>
        <b>BRAT Viewer</b>
        <p style={{ color: '#999' }}>Annotation visualization</p>
      </div>
    </div>
  )
}
