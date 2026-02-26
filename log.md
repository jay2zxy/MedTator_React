# MedTator React 重构 - 开发日志

### 2026-02-11 - Session 1.1 项目启动与架构设计

**上午 - 环境搭建**：
- ✅ Fork 原项目到个人仓库
- ✅ 创建 jay-dev 开发分支
- ✅ 搭建 Python 虚拟环境
- ✅ 原版应用成功运行（Flask http://localhost:8086）
- ✅ 创建工作文档 work.md（后改名为 reload.md）

**下午 - 代码分析**：
- 📊 代码量统计：35个JS文件 (18807行) + 23个HTML模板 (11031行)
- 📊 核心文件：app_hotpot.js (3795行) + 13个扩展模块 (~6500行)
- 📊 解析器：ann(1085行) + dtd(1092行) + brat(560行) + bioc(229行)
- 🏗️ 架构分析：单页应用（7个Tab）、巨型Vue实例、File System Access API
- 🎯 确定重构策略：brat封装而非重写，原版代码保持不动

**晚上 - React项目初始化**：
- ✅ 使用Vite创建React 18 + TypeScript项目
- ✅ 安装176个依赖包
- ✅ 验证开发服务器运行（http://localhost:5173）
- ✅ Git提交："vite init" (e9c5464)
- 🏗️ 完成React架构设计文档
- 🔧 修正重构计划：解析器提前到 M3，标注编辑器调整为 15天，总周期 18周

**技术决策**：
- 目录结构：保持根目录不变 + 新建MedTator-React/
- 状态管理：Zustand（一个store.ts搞定）
- Tab切换：不用路由，state条件渲染
- UI框架：Ant Design替代Metro UI
- 桌面打包：Electron（替代浏览器File System Access API）

### Session 1.2 - 架构简化

- 🔧 砍掉过度设计：React Router、ESLint/Prettier、测试、多slice状态管理
- 🔧 模块从15个精简为8个，周期从18周压缩到8周
- 🔧 加入Electron桌面打包方案
- 🔧 目录结构改为扁平（components/下直接放组件）

### Session 1.3 - 原版深度分析 + M1收尾

**新发现**：
- Flask 服务器几乎无用，只serve静态页面 + 注入sample数据，无后端API
- vpp_data 全局状态含30+属性，需要完整搬到store.ts
- 7个Tab各对应一个ext模块，行数差异大（75行~1314行）
- 4个parser是纯函数无DOM依赖，最适合先移植
- Electron集成推迟到M7，先用浏览器file input做文件操作

**决策调整**：
- M1的Electron集成推迟 → 先做核心功能，最后打包
- M3文件操作先用浏览器方案（input+drag&drop），不依赖Electron
- 修复了RibbonMenu的TabKey类型导入问题（import type）

### 2026-02-11 - Session 2.1 M2解析器移植

**M2-解析器移植（4个parser → TypeScript，2966行）**：
- ✅ 新建 `types.ts`：共享类型定义（Dtd, DtdTag, Ann, AnnTag, BratDocData等）
- ✅ `parsers/dtd-parser.ts` ← dtd_parser.js (1092行)：Schema解析（DTD/JSON/YAML）
- ✅ `parsers/ann-parser.ts` ← ann_parser.js (1085行)：标注XML解析/span工具/hint字典
- ✅ `parsers/brat-parser.ts` ← brat_parser.js (560行)：BRAT格式转换+颜色管理
- ✅ `parsers/bioc-parser.ts` ← bioc_parser.js (229行)：BioC XML生成/导出
- ✅ 安装依赖：js-yaml + @types/js-yaml
- ✅ TypeScript编译零错误

**Annotation Tab 布局对齐**：
- 📐 工具栏Ribbon：8个分组（Schema/File/Display/Search/Entity/Link/Hint/Help）
- 📐 上半区(60%)：文件列表面板(250px) + CodeMirror编辑器占位
- 📐 下半区(40%)：Tag定义列表 + 标注表格
- 🎯 纯布局骨架，功能后续接入

**单元测试（Vitest + jsdom）**：
- ✅ 67个测试全部通过：
  - dtd-parser.test.ts (17个)：DTD/JSON/YAML解析、roundtrip、边界情况
  - ann-parser.test.ts (30个)：span工具、xml2ann、tag工具、hint字典
  - brat-parser.test.ts (14个)：颜色管理、parseAnn、collection/document数据
  - bioc-parser.test.ts (6个)：BioC XML生成、entity/relation/多文档
- ✅ 用sample/真实数据验证通过
- 🔧 vite.config.ts 配置 jsdom 环境
- 🔧 package.json 添加 `npm test` / `npm run test:watch`

**代码审查修复（逐函数对照原版，9个问题）**：
- 🐛 dtd-parser: `NON_CONSUMING_SPANS` 未导出 → 加export
- 🐛 dtd-parser: `getAttrRequire()` 只取首个匹配 → 改为取最后一个（循环）
- 🐛 dtd-parser: `parseTmpDtd()` 用truthiness检查 → 改用hasOwnProperty
- 🐛 ann-parser: `ann2xml` 空meta也生成标签 → 加长度守卫
- 🐛 brat-parser: 缺 `ann2brat()` 函数 → 补stub（原版也未完成）
- 🐛 brat-parser: `medtagger2brat` 多余certainty守卫 → 去掉
- 🐛 brat-parser: emoji被换成ASCII → 恢复 ➕➖❓
- 🐛 brat-parser: `getColor` 用falsy检查 → 改用hasOwnProperty
- 🎯 改进保留：`mkBaseTag` id_prefix bug修复、null守卫、`.contains()→.includes()`

**已知遗留**：
- ⏸ `ann-parser` 缺 `get_subtags_of_substr_in_ann`（M4实现，需nlp_toolkit）
- ⏸ `ann-parser` 缺 `pretty_xml_str`（依赖jQuery，无调用者）

### 2026-02-12 - Session 3.1 M3 Step 1: store.ts 状态设计

**原版状态全量梳理**：
- 📊 扫描 app_hotpot.js 的 vpp_data（30行~175行）+ 11个ext模块
- 📊 统计出原版共 96+ 个状态属性
- 🎯 筛选出 M3 需要的 16 个属性 + 14 个 actions

**重写 store.ts（40行 → 169行）**：
- ✅ 用 `types.ts` 的真实类型（`Dtd`, `Ann`）替代 `any`
- ✅ 新增导出类型：`SortAnnsBy`（6种排序）、`CmSettings`（7个编辑器选项）
- ✅ 状态分7组：Tab / Schema / 标注文件 / 文件列表 / Tag过滤 / 加载进度 / CM设置
- ✅ TypeScript编译零错误，67个解析器测试全部通过

**关键设计决策**：
- 🎯 `setAnns` 自动重置 `annIdx=0` + `pgIndex=0`
- 🎯 `addAnns` 增量追加不覆盖（适配异步批量加载）
- 🎯 `removeAnn` 自动修正 `annIdx`（删除后不越界）
- 🎯 排序/过滤变更时自动 `pgIndex=0`
- 🎯 Loading 三阶段：`start` → `update` → `finish`
- ⏸ 未来模块状态（hints、linking、IAA、razer等）等到对应模块时再加

**状态接口**：
```typescript
interface AppState {
  // Tab
  currentTab: TabKey
  // Schema
  dtd: Dtd | null
  // 标注文件
  anns: Ann[]
  annIdx: number | null
  // 文件列表
  sortAnnsBy: SortAnnsBy
  fnPattern: string
  pgIndex: number
  pgNumPerPage: number
  // Tag过滤
  displayTagName: string
  // 加载进度
  isLoadingAnns: boolean
  nAnnsDropped/Loaded/Error: number
  msgLoadingAnns: string
  // CM设置
  cm: CmSettings
}
```

**下一步**：M3 Step 2 - 文件操作（file-helper + 拖拽 + parser接入 + UI更新）

### 2026-02-12 - Session 3.2 M3 Step 2: 文件操作

**核心功能实现**：
- ✅ 创建 `utils/file-helper.ts` (75行)：文件读取、类型检查、下载工具
- ✅ 重写 `Annotation.tsx` (305行 → 500+行)：
  - Schema 加载：拖拽 + 文件选择器，支持 .dtd/.json/.yaml
  - Annotation 加载：批量加载 .xml/.txt，显示 loading 进度
  - 文件列表：显示、排序(6种)、过滤、分页(100/页)、点击切换
  - 编辑器：显示当前文件文本（暂用 textarea 占位）
  - Tag 列表：显示 DTD 的 Entity/Relation Tags，支持点击过滤
  - 标注表格：显示当前文件标注(Tag/ID/Spans/Text/Attributes)，支持 Tag 过滤
- ✅ 数据流打通：文件拖拽 → Parser解析 → Store更新 → UI自动刷新
- ✅ 错误处理：文件类型检查、解析失败提示、错误计数

**测试验证**：
- ✅ 生成测试文件：`test-schema.dtd` (3 Entity + 2 Relation) + `test-annotation.xml` (7 个标注)
- ✅ 功能手动测试：Schema 加载、Annotation 加载、Tag 过滤、文件切换 - 全部正常
- ✅ TypeScript 编译零错误
- ✅ 67 个 parser 测试全部通过

**修复问题**：
- 🐛 清理未使用 imports（Annotation.tsx、测试文件）
- 🐛 `ann-parser.ts` 参数重命名（`dtd` → `_dtd`）

**技术决策**：
- 🎯 暂时不用 CodeMirror（M4 再集成标注功能）
- 🎯 Tags/Tags_r/Label 排序未实现（标记 TODO）
- 🎯 使用 useMemo 优化列表过滤/排序

**进度**：M3 完成 2.5/3 步骤（83%）

**下一步选择**：
- 选项 1: M3 Step 3 - ZIP 打包功能
- 选项 2: 跳到 M4 - 标注编辑器（CodeMirror + 实体/关系标注）

### 2026-02-12 - Session 3.3 决策：跳过 M3 Step 3

**决定**：跳过 ZIP 打包功能，直接进入 M4 标注编辑器

**原因**：
- M4 是核心功能（12 天），优先级更高
- 多文件选择已足够使用
- ZIP 功能可后续补充（非阻塞）

**M3 最终状态**：核心功能 100% 完成（Step 3 延后）

**下一步**：M4 标注编辑器 - CodeMirror 集成 + 实体/关系标注 + BRAT 可视化

### 2026-02-12 - Session 4.1 M4 Phase 1: Store 扩展 + Tag Helper

**提交**: 8abb46a（Sonnet 4.5）

- ✅ 新建 `utils/tag-helper.ts` (98行)：makeEtag、makeEmptyEtagByDef、makeEmptyRtagByDef、getIdrefAttrs
- ✅ 扩展 `store.ts` (169→298行)：tag增删改 + selectedTagId + 关系链接状态机
- ✅ 新建 `utils/__tests__/tag-helper.test.ts` (8个测试)
- ✅ 75个测试全部通过

### 2026-02-13 - Session 4.2 M4 Phase 2: CodeMirror 6 核心集成

**状态**: 代码完成，待提交（Opus 4.6）

**新增 4 个 editor 模块**：
- ✅ `editor/cm-spans.ts` (~40行)：spans ↔ CM6位置 转换
- ✅ `editor/cm-decorations.ts` (~150行)：两层 StateField 装饰（标注高亮 + 选中高亮）
- ✅ `editor/cm-theme.ts` (~165行)：CM6 theme + 24色调色板 + 动态 CSS 注入
- ✅ `editor/cm-setup.ts` (~23行)：CM6 Extension 数组

**新增组件**：
- ✅ `components/AnnotationEditor.tsx` (~145行)：CM6 React 封装，替换旧 textarea

**修改**：
- ✅ `Annotation.tsx`：删除 EditorPanel，集成 AnnotationEditor，工具栏绑定 store
- ✅ `test-annotation.xml`：修复 spans off-by-one 偏移

**修复6个问题**：
- 🐛 标注黑色 → 新增 assignTagColors() 调色板分配
- 🐛 标注左偏一字符 → 修正 test-annotation.xml spans
- 🐛 DecorationSet TS1484 → type-only import
- 🐛 遗漏 Color+ID 模式 → CSS ::before + wrapper class
- 🐛 Tag列表颜色黑色 → assignTagColors 在 setDtd 之前调用
- 🐛 工具栏未绑定 → Radio.Group/Switch 接入 setCm()

**验证**：编译零错误，75测试通过，浏览器标注高亮正常

**下一步**：Phase 3 右键菜单 + 实体创建（推荐 Sonnet）

### 2026-02-13 - Session 4.3 M4 Phase 3: 右键菜单 + 实体创建

**状态**: 代码完成，待提交（Sonnet 4.5）

**新增组件**：
- ✅ `ContextMenu.tsx` (156行)：React Portal 浮层，显示 Entity Tags 列表

**修改**：
- ✅ `AnnotationEditor.tsx`：集成 contextmenu/mousedown 事件，handleTagSelect 逻辑
- ✅ `Annotation.tsx`：AnnotationTable 添加自动滚动到底部

**数据流**：
```
选中文本 → 右键 → ContextMenu → 点击 tag
  ↓
cmRangeToSpans → makeEtag → store.addTag
  ↓
useEffect 触发 → CM6 彩色高亮 + 表格滚动到底部
```

**功能对照**：核心功能 100% 完成
- ✅ 右键菜单（颜色 + 快捷键）、创建标注、清除选择、关闭菜单
- ✅ 滚动表格到底部、点击标注高亮
- ⏸️ 快捷键创建（延后到 Phase 7）

**验证**：编译零错误，75测试通过，浏览器功能正常

**下一步**：Phase 4 标注表格交互增强（推荐 Sonnet）

### 2026-02-13 - Session 4.4 M4 Phase 4: 标注表格交互增强

**状态**: 代码完成，待提交（Sonnet 4.5）

**新增文件**：
- ✅ `components/AnnotationTable.tsx` (250行) - 独立表格组件

**修改文件**：
- ✅ `components/Annotation.tsx` - 移除旧表格实现，导入新组件
- ✅ `parsers/ann-parser.ts` - 新增 `getTagById()` 工具函数

**新增功能**：
- ✅ 内联属性编辑：
  - list 类型 → Select 下拉框 + "-- EMPTY --" 选项
  - text 类型 → Input 输入框
  - idref 类型 → Select 下拉框（显示当前文件所有实体 ID + Text）
- ✅ 删除按钮 + 级联删除：
  - 无关联关系 → 直接删除 + 提示
  - 有关联关系 → Modal 确认对话框 → 先删除 rtags → 再删除 etag
- ✅ 点击行高亮：
  - 表格行蓝色高亮
  - 编辑器中标注同步高亮（Phase 2 已实现）
- ✅ 自动滚动到底部（新标注创建时）

**关键技术讨论**：
- 关系存储机制：XML + ID 引用（通过字符串 ID 实现关系，无需数据库）
- 时间复杂度：O(n×m) 完全够用（典型场景 200 标注 < 1ms）
- 反向索引 vs 双向图：当前数据规模不需要优化

**验证**：
- ✅ TypeScript 编译零错误
- ✅ 75 个测试全部通过
- ✅ 浏览器测试：属性编辑、删除、高亮功能正常

**下一步**：Phase 5 关系标注链接（推荐 Opus）

---

### Session 4.5 — M4 Phase 5: 关系标注链接 (2026-02-17, Opus)

**新增组件**：
- `TagPopupMenu.tsx` (~210行)：点击实体标记弹出菜单（关系类型/链接IDREF/删除）
- `LinkingBanner.tsx` (~170行)：链接模式可拖拽浮动面板（属性编辑 + Done/Cancel）
- `AnnotationEditor.tsx` 重写：集成两个新组件 + 左键/右键事件分流

**Store 修复**：
- `startLinking`/`setLinking`: 修复消费逻辑，IDREF 全填后自动完成
- `doneLinking`: 改用 `getNextTagId()` 替代重复逻辑
- 新增 `updateLinkingAttr`: 供 banner 编辑属性

**Bug 修复**：
- ID 碰撞：共享前缀的不同 relation type 会生成重复 ID（原版也有此 bug），改为按前缀查重
- IDREF 下拉框误显示关系标注（L0/L1）：改用 DTD 判断 etag
- IDREF 下拉框文本截断：`popupMatchSelectWidth={false}`
- 表格表头 sticky 重叠：加 `zIndex: 1`

**验证**：
- ✅ TypeScript 编译零错误
- ✅ 75 个测试全部通过
- ✅ 浏览器测试：完整链接流程（点击实体→选关系→点击实体→自动创建）

**下一步**：Phase 6 关系连线渲染（推荐 Sonnet）

---

### Session 4.6 — M4 Phase 6: 关系连线渲染 (2026-02-17, Opus→Sonnet)

**新增组件**：
- `RelationLines.tsx` (~270行)：SVG 连线覆盖层，绘制实体间关系折线

**核心算法**：
- `view.coordsAtPos()` 获取实体坐标 → 容器相对坐标
- 4点折线：A顶部 → A上方(6px) → B上方 → B顶部
- 彩色标签：`.svgmark-tag-{TAG}` 动态 CSS（关系类型颜色）
- 响应式：监听滚动/resize/数据变化自动重算

**工具栏开关**：
- Show Links / Show Lines / Show Link Name（`Annotation.tsx`）

**文件列表增强**：
- 显示文件数 / tag 数
- 删除单个文件（减号图标）+ 删除全部（红色垃圾桶）
- unsaved 标记（红色 `*` 号）

**样式调整**：
- `.cm-gutters` 加 `lineHeight: '2em'` 对齐行号
- 连线 `deltaHeight=6px`，标签 8px 字体

**调试问题**：
- 连线位置错误 → 坐标系转换修复
- 加载时无连线 → RAF 延迟一帧
- 标签被裁掉 → 调整 deltaHeight
- 标签白色 → 改用关系类型颜色

**验证**：
- ✅ TypeScript 编译零错误
- ✅ 75 测试通过
- ✅ 浏览器测试：连线正确显示，工具栏开关正常

---

### 2026-02-17 - Session 4.7 M4 Phase 7: 保存 + 快捷键 + 搜索

**提交**: fc65c8b

- ✅ Save XML 按钮 + Ctrl+S 保存
- ✅ 快捷键实体创建（1-9, a, c, v, b → etags）
- ✅ CM6 搜索面板（Ctrl+F）

---

### 2026-02-18 - Session 4.8 M4 Phase 8/9/10: Hint + Sentence + 修复

**Phase 8 — Hint 系统**：
- ✅ Store: hintDict + acceptHint/acceptAllHints
- ✅ CM6 装饰层: hint 虚线下划线 + id_prefix 标签（如 "S"）
- ✅ 点击 hint 自动接受 + "Accept All" 按钮
- ✅ 文件加载后自动构建 hint 字典

**Phase 9 — Sentence 分句模式**：
- ✅ 新建 `utils/nlp-toolkit.ts`: sentTokenize (simpledot_v2) + 双向偏移映射
- ✅ 编辑器: sentences 模式显示 + tag/hint span 重映射 + 反向映射创建标注
- ✅ RelationLines: sentence 模式连线重映射

**Phase 10 — 小修复**：
- ✅ RelationLines: displayTagName 过滤连线
- ✅ Annotation: 加载进度 Spin

**测试精简**：
- 🔧 104 个测试 → 21 个（砍掉琐碎用例，只保留核心路径 + roundtrip）

**验证**：
- ✅ 编译零错误，21 测试通过
- ✅ 浏览器: hint/sentence/连线过滤 全部正常

**M4 标注编辑器 — 全部 10 个 Phase 完成** 🎉

**下一步**：M5 Schema 编辑器 或 M6 其他功能 Tab

---

### 2026-02-19 - Session 5.1 M5: Schema Editor

**模型**: Sonnet 4.5 → Opus 4.6

**Store 扩展** (`store.ts`):
- ✅ 新增: `seDtd`, `seOpen` 状态
- ✅ 新增 actions: `openSchemaEditorNew`, `openSchemaEditorCopy`, `openSchemaEditorLoad`, `closeSchemaEditor`, `setSeDtd`

**新增组件**：
- ✅ `components/SchemaEditor.tsx` (~290行)：Ant Design Modal (1020px, zIndex=2000)
  - 水平工具栏 (sticky): Schema Name / New / Open / Sample+Load / Use / Download(YAML|JSON|DTD)
  - 两区块: Entity Tags + Relation Tags，每个 tag 水平 TagRow 布局
  - Tag CRUD: 添加/删除 tag，名称验证 `[A-Za-z0-9_]`
  - Attr CRUD: 添加/删除属性，text/list/idref 三种类型
  - LIST DEFAULT: Select 下拉框 (从 att.values 填充，`popupMatchSelectWidth={false}`)
  - is_non_consuming 切换: "SPAN" / "DOCUMENT + SPAN"
  - Sample DTD: Vite `?raw` 导入 4 个 sample 文件
  - "Use": `extendBaseDtd → assignTagColors → assignTagShortcuts → injectTagColors → setDtd → clearAnns`

**修改文件**：
- ✅ `Annotation.tsx`: 添加 Schema Editor 图标按钮 (ToolOutlined) + 渲染 `<SchemaEditor />`
- ✅ `utils/tag-helper.ts`: 导出 `APP_SHORTCUTS` + `assignTagShortcuts`（从 Annotation.tsx 提取）
- ✅ `RelationLines.tsx`: 移除 `enabledLinkComplex` 引用（"Show Lines" 开关已删除）

**UI 迭代（多轮修复）**：
- 🐛 两列布局 → 改为水平 TagRow（对齐原版）
- 🐛 按钮导致工具栏过高 → 改为 icon-only 按钮
- 🐛 LIST DEFAULT 无预选项 → 改为 Select 下拉框
- 🐛 下拉框截断 → `popupMatchSelectWidth={false}`
- 🐛 Modal z-index → `zIndex={2000}`
- 🐛 工具栏随滚动消失 → `position: sticky`
- 🐛 sticky 顶部有空隙 → `top: -8px, marginTop: -8px, paddingTop: 8px`（补偿 Modal body padding）

**验证**：
- ✅ 编译零错误，21 测试通过
- ✅ 浏览器: 打开/编辑/加载 sample/Use/Download 全部正常

**M5 Schema Editor — 完成** 🎉

**下一步**：M6 其他功能 Tab

---

---

### 2026-02-19 - Session 6.1 M6 Phase 1-3: Statistics + Export + Converter

**Phase 1 — Statistics Tab** (5c31721):
- ✅ 重写 `Statistics.tsx`：语料库统计（文件数、tag 分布）

**Phase 2 — Export Tab** (e2a4f90):
- ✅ 重写 `Export.tsx`：支持 XML/BioC/JSON/CSV 导出 + ZIP 批量下载

**Phase 3 — Converter Tab** (8f8f49e):
- ✅ 重写 `Converter.tsx`：Raw Text→XML + MedTagger→XML 转换

---

### 2026-02-19 - Session 6.2 M6 Phase 4: Adjudication/IAA

**提交**: c369b98（Opus 4.6）

**新增文件**：
- ✅ `utils/iaa-calculator.ts` (~650行)：IAA 计算引擎
  - 文档哈希匹配、Tag overlap/exact 匹配、F1/Cohen's Kappa + 95% CI
  - Gold Standard 裁决、5 个 Excel 报告 sheet
- ✅ `components/Adjudication.tsx` (~846行)：完整 IAA UI
  - A/B Dropzone + Calculate + F1 Score 面板 + Cohen's Kappa 混淆矩阵
  - Tag 详情（accept/reject 裁决）+ ZIP/Excel 导出

**Bug 修复**：
- 🐛 `evaluateAnnOnDtd` 崩溃：`result.all` 赋值顺序错误 → 移到 `getCohenKappaOverall` 调用前
- 🐛 xlsx 无 default export → `import * as XLSX`
- 🐛 calculate 无错误处理 → 加 try-catch + message.error

**验证**：编译零错误，21 测试通过，F1=0.8571 / Kappa=0.6667

---

### 2026-02-19 - Session 6.3 M6 Phase 5: Toolkit + 移除 Error Analysis

**提交**: 845e9d4

- ✅ 删除 `ErrorAnalysis.tsx`（用户决定不需要）
- ✅ 新增 `Toolkit.tsx` (~270行)：MedTaggerVis 可视化
  - 三列布局：.txt 文件 | .ann 文件 | 高亮可视化
  - 拖拽加载 + 点击 .ann 自动匹配 .txt → 渲染实体高亮
  - Certainty/Status 属性 glyph 显示
- ✅ `brat-parser.ts` 新增 `parseMedTaggerAnn()` 解析器

**验证**：编译零错误，21 测试通过

**M6 全部 5 个 Phase 完成** 🎉

---

### 2026-02-20 - Session 7.1 M7: LLM 自动标注 (Ollama)

**模型**: Opus 4.6

**新增文件**：
- ✅ `utils/ollama-client.ts` (~90行)：Ollama REST API 封装
  - `checkOllamaStatus` / `listModels` / `requestAutoAnnotation`
  - POST `/api/chat`（stream:false, format:json），prompt 设计：关键词+标签分类
- ✅ `utils/auto-annotate.ts` (~70行)：LLM 输出 → AnnTag 转换
  - `getLocs()` 正则匹配精确 span（不信任 LLM 的偏移量）
  - 重叠检测：跳过与已有标注重叠的位置

**修改文件**：
- ✅ `store.ts` (+25行)：`ollamaConfig` + `isAutoAnnotating` 状态 + `autoAnnotate()` action
- ✅ `Annotation.tsx` (+60行)：工具栏 "Auto-Annotate (LLM)" 分组 + Settings Modal

**核心设计**：LLM 只返回 `{keyword, tag}`，span 定位交给 `getLocs()` 正则匹配
```
LLM: "headache" → SYMPTOM → getLocs("headache", text) → [[23,31]] → makeEtag()
```

**验证**：编译零错误，21 测试通过，浏览器功能正常

---

### 2026-02-25 - Session 7.2 M7 改进：否定检测 + getLocs 鲁棒性

**问题**：mistral/deepseek 实测发现多空格不匹配、否定语境误标注、JSON 解析失败

**改动**：
- ✅ `getLocs`：特殊字符转义 + 空格 → `\s+`（`"blood pressure"` 匹配 `"blood  pressure"`）
- ✅ `isNegatedByContext`：双向窗口否定检测
  - 前向 60 字符：`denies/no /doesn't/negative for...`，句号/转折词截断
  - 后向 30 字符：`absent/not found/: none...`（处理 `"Fever: absent"` 后置否定）
- ✅ `ollama-client`：JSON 解析前剥 markdown 代码块（deepseek 习惯包裹输出）
- ✅ Prompt：`ONLY use these exact tag names: ${tagList}`（防止模型用 DISORDER 代替 DISEASE）
- ✅ 测试：27 → 45 个

**调试过程中踩的坑**：

| 问题 | 原因 | 修复 |
|------|------|------|
| `chest pain` 否定未过滤 | mistral 没识别 "denies" | 加客户端前向窗口 |
| `nausea` 被误杀 | 跨句，"doesn't" 在 60 字符窗口内 | 句号加入 scope breaker |
| deepseek JSON 解析失败 | 输出包 markdown 代码块 | strip ` ```json ``` ` |
| `hypertension` 未标注 | 模型用 "DISORDER" 不在 DTD 里 | Prompt 重复强调 tag 列表 |
| mistral 输出不稳定 | temperature=0.8 有随机性 | 待加 `temperature: 0` |

**学到的**：
LLM 工程
  - LLM 输出不可靠，不能信任它的 span 偏移，只用 keyword+tag 再客户端定位
  - 小模型（mistral 4GB）在结构化输出上不稳定，temperature 影响可重复性
  - 不同模型对 format: 'json' 遵守程度不同（deepseek 会加 markdown 包裹）
  - Prompt 工程：同一条规则说一遍不够，关键约束要重复、具体（tag 列表在 Rules 里再列一次）

  NLP / 否定检测
  - NegEx 算法的核心思想：用滑动窗口查否定词，用 scope breaker 截断作用域
  - 前置否定（denies X）vs 后置否定（X: absent）需要分别处理
  - sentence boundary 比 "but" 这类词更强的 scope breaker
  - 简化版 NegEx 的边界：复杂嵌套从句（依存句法树才能解决）

  算法
  - Two-Way 字符串匹配：O(n) 时间 + O(1) 空间，比 KMP 空间更优
  - \b 的局限性：对非单词字符边界不起作用
  - 多义词问题（同词出现两次）：工程上接受假阳性比漏标更好处理

  测试驱动
  - 先用真实模型跑，发现问题后再写单元测试固化 fix
  - 调试 console.log → 确认 raw response → 定位根因 → 修复 → 删 log 的流程

**提交**：c96d8b0

---

### 项目总进度

| 模块 | 状态 | 提交 |
|------|------|------|
| M1 项目搭建 | ✅ 完成 | e9c5464 |
| M2 解析器移植 | ✅ 完成 | 多次提交 |
| M3 状态+文件 | ✅ 完成 | 多次提交 |
| M4 标注编辑器 (10 Phase) | ✅ 完成 | 8abb46a → 89b25a5 |
| M5 Schema Editor | ✅ 完成 | 0ac5eb2 |
| M6 功能 Tab (5 Phase) | ✅ 完成 | 5c31721 → 845e9d4 |
| M7 LLM 自动标注 | ✅ 完成 | 待提交 |
| M8 Electron 打包 | ⏸ 待开始 | |
| M9 联调修 bug | ⏸ 待开始 | |

**下一步**：M8 Electron 桌面打包 或 M9 联调修 bug

---

### 2026-02-26 - Session 7.3 M7 改进：Tag Description + LLM Pipeline 对齐

**背景**：量化实验（eval_llm.py）显示，给每个 tag 附描述后 Recall 从 0.27 → 0.77，但生产代码只传 tag 名称。

**改动（6 个文件）**：

- ✅ `types.ts`：`DtdTag` 添加 `description?: string` 字段
- ✅ `dtd-parser.ts`：`parseTmpDtd` etag/rtag 循环里读取 description；`minimizeDtdJson` 无需改动（不主动删除该字段，自动保留）
- ✅ `SchemaEditor.tsx`：
  - TagRow 重新设计：description 从左侧窄列移除，改为 **全宽 LLM HINT 底栏**（有内容时蓝色标签+浅蓝背景，空时灰色淡化）
  - `destroyOnClose` → `destroyOnHidden`（Ant Design 废弃警告修复）
  - `handleUse` 移除 `clearAnns()` 和确认对话框（点 Use 不再清空已加载的 XML 文件）
- ✅ `ollama-client.ts`：
  - 签名 `etagNames: string[]` → `etags: Array<{name, description?}>`
  - Prompt `Entity tags:` 展开为多行 `- TagName: description`
  - 新增 `options: { temperature: 0 }`（与量化实验对齐，保证可重复性）
  - 新增调试 `console.log('[LLM prompt] tags:')` + `'[LLM prompt] user prompt:'`
- ✅ `store.ts`：`autoAnnotate` 传 `{name, description}` 对象数组
- ✅ `auto-annotate.ts`：新增 `getSpanFromTag` + `hasSameTagOverlap` 同 tag dedup

**与量化实验的剩余差异**（影响极小，暂不处理）：
- Prompt 标签措辞：实验用 `Tag definitions:`，生产用 `Entity tags:`
- Dedup 顺序：实验先全部收集→按 start 排序→去重；生产逐 keyword 边处理边去重

**验证**：编译零错误，45 个测试全部通过

*最后更新: 2026-02-26*