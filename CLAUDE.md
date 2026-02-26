# MedTator 重构项目


**文档**：CLAUDE.md（精简版，给AI看）| log.md（给人看）| reload.md（架构/运行指南）
**注意**：log.detail.md 仅供人工查阅，AI 不需要读取，除非用户明确要求。

---

## 开发规则

### 每个 Phase 完成前必须执行

1. `npm run build` — TypeScript 编译零错误
2. `npm test` — 所有测试通过（当前 45 个）
3. **逐功能比对原版** — 原版 Flask 应用（localhost:8086）和 React 版（localhost:5173）：UI 控件 → store 接入 → 渲染效果 → 交互行为，全部一致才算完成

### 教训

- **M4 Phase 2**：只看编译/测试通过就判定完成，漏掉了 node 模式、Tag 颜色同步、Toolbar 开关绑定。必须逐功能对比原版。

---

## 项目状态（截至 2026-02-26）

| 模块 | 状态 | 提交 |
|------|------|------|
| M1 项目搭建 | ✅ | e9c5464 |
| M2 解析器移植（4个 parser → TS） | ✅ | 多次 |
| M3 状态管理 + 文件操作 | ✅ | 多次 |
| M4 标注编辑器（10 Phase） | ✅ | 8abb46a→89b25a5 |
| M5 Schema Editor | ✅ | 0ac5eb2 |
| M6 其他 Tab（Statistics/Export/Converter/IAA/Toolkit） | ✅ | 5c31721→845e9d4 |
| M7 LLM 自动标注（Ollama） | ✅ | 8f37861→c96d8b0→待提交 |
| M8 Electron 打包 | ⏸ 待开始 | |
| M9 联调修 bug | ⏸ 待开始 | |

---

## 技术栈

- React 18 + TypeScript + Vite + Ant Design + Zustand
- CodeMirror 6（标注编辑器）
- Vitest + jsdom（单元测试）
- Electron（M8，桌面打包，替代浏览器 File System Access API）
- Ollama REST API（M7，LLM 自动标注）

---

## 关键文件（MedTator-React/src/）

```
store.ts              # 全局状态（Zustand）：dtd/anns/annIdx/cm/linking/hints/ollamaConfig...
types.ts              # 共享类型：Dtd/DtdTag/DtdAttr/Ann/AnnTag/BratDocData...
components/
  Annotation.tsx      # 标注 Tab：Ribbon 工具栏 + 文件列表 + 编辑器 + Tag 列表
  AnnotationEditor.tsx# CM6 编辑器：标注高亮/hint/sentence/右键菜单/链接
  AnnotationTable.tsx # 标注表格：属性内联编辑 + 级联删除
  ContextMenu.tsx     # 右键菜单（文本选中 → 创建实体）
  TagPopupMenu.tsx    # 左键菜单（点击标注 → 关系链接/删除）
  LinkingBanner.tsx   # 链接模式浮动面板（可拖拽）
  RelationLines.tsx   # SVG 关系连线
  SchemaEditor.tsx    # Schema Editor 弹窗（Tag/Attr CRUD）
  Statistics.tsx      # 语料库统计
  Export.tsx          # 多格式导出（XML/BioC/JSON/CSV + ZIP）
  Adjudication.tsx    # IAA（F1/Cohen's Kappa + 裁决 + Excel 报告）
  Converter.tsx       # 格式转换（Raw Text/MedTagger → XML）
  Toolkit.tsx         # MedTaggerVis 可视化
editor/
  cm-decorations.ts   # 3层 StateField：tag高亮 + selected高亮 + hint高亮
  cm-theme.ts         # 主题 + 24色调色板 + 动态 CSS 注入
  cm-spans.ts         # spans字符串 ↔ CM6位置 转换
  cm-setup.ts         # CM6 Extension 数组
parsers/
  dtd-parser.ts       # Schema 解析（DTD/JSON/YAML）
  ann-parser.ts       # 标注 XML 解析 + span工具 + hint字典
  brat-parser.ts      # BRAT 格式转换 + MedTagger 解析
  bioc-parser.ts      # BioC XML 导出
utils/
  file-helper.ts      # 文件读取/下载
  tag-helper.ts       # makeEtag/makeRtag + 快捷键分配
  nlp-toolkit.ts      # 分句器（simpledot_v2）+ 偏移映射
  iaa-calculator.ts   # IAA 计算引擎（F1/Kappa/GS/混淆矩阵）
  ollama-client.ts    # Ollama REST API 封装（checkStatus/listModels/requestAutoAnnotation）
  auto-annotate.ts    # LLM输出 → AnnTag（getLocs正则匹配精确span + 重叠检测）
```

---

## 关键模式 / 坑

### Schema 加载顺序（必须严格遵守）
```typescript
assignTagColors(parsed)   // 1. 先分配颜色到 dtd 对象
assignTagShortcuts(parsed)// 2. 分配快捷键
setDtd(parsed)            // 3. 存入 store
injectTagColors(parsed)   // 4. 注入 <style> 标签（此时 store 已有颜色）
```

### CM6 装饰更新（AnnotationEditor.tsx）
- 用 `StateEffect` + `StateField`，不要直接操作 DOM
- 文档更新：`view.dispatch({ changes: {...} })`
- 装饰更新：`view.dispatch({ effects: [setTagDecorations.of(ranges)] })`
- 初始化后保持容器 div 始终挂载（用 `visibility: hidden` 处理空状态）

### 关系链接状态机（store.ts）
```
startLinking(rtagDef, firstEntityId) → isLinking=true
  → 用户点击第二个实体 → setLinking(attIdx, entityId)
  → linkingAtts 为空 → doneLinking() → 自动创建 rtag
  → 或 cancelLinking()
```

### LLM 自动标注（M7 + 改进）
- **不信任 LLM 的 span 偏移**，只用 `{keyword, tag}` 对
- `getLocs(keyword, text)`：转义正则特殊字符，空格 → `\s+`（匹配多空格文本）
- 重叠检测：跳过与已有/新建 tags 重叠的位置；同 tag dedup（`hasSameTagOverlap`）
- Prompt：`format: 'json'`，`temperature: 0`，Rules 里重复 tag 列表
- **Tag description**（LLM HINT）：`DtdTag.description?` 字段，Schema Editor 底部全宽输入栏，JSON schema 保存/加载，传入 `requestAutoAnnotation(etags: {name, description?}[])`，prompt 里展开为 `- TagName: description`
- JSON 解析：先剥 markdown 代码块（` ```json ``` `），再 fallback 到 `/{[\s\S]*}/` 抠取
- **否定检测**（`isNegatedByContext`，双向窗口）：
  - 前向 60 字符：查 `denies/no /doesn't/negative for...`，遇句号/转折词截断
  - 后向 30 字符：查 `absent/not found/: none...`，遇句号截断
  - 处理不了：跨句复杂从句（NegEx 完整实现才能覆盖）

### ID 生成（getNextTagId）
- 按 `id_prefix` 前缀查重（不按 tag name），避免共享前缀时碰撞
- 例：`LK_SYMPTOM_DISEASE` 和 `LK_MED_DISEASE` 都用前缀 "L"，必须跨类型计数

### Vite/TypeScript 导入
- 纯类型必须用 `import type { Foo }` 而非 `import { Foo }`（esbuild verbatimModuleSyntax）

### ann.tags 临时修改模式（auto-annotate.ts）
- 临时 push 到 `ann.tags` 确保 `getNextTagId` 自增正确
- 返回前用 `splice` 撤回，由调用方负责实际 `addTag`

---

## 下一步（M8）

Electron 桌面打包：
- 主进程 + 预加载脚本（ipcMain/ipcRenderer）
- Node.js `fs` 替代浏览器 file input（可选，input 方案已可用）
- 打包成 .exe（Windows）/ .dmg（macOS）
- `electron-builder` 或 `electron-vite`
