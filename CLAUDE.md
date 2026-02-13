# MedTator 重构项目 - Claude会话记录

**文档说明**：
- **CLAUDE.md** - 详细会话记录（给 AI 看）
- **log.md** - 简洁开发日志（给人看）
- **reload.md** - 构建/架构指南（如何运行/理解项目）

---

## 开发规则

### 验收标准（每个 Phase 完成前必须执行）

1. `npm run build` — TypeScript 编译零错误
2. `npm test` — 所有测试通过
3. **逐功能比对原版**：打开原版 Flask 应用（localhost:8086）和 React 版（localhost:5173），对同一份测试数据，逐个功能点对比：
   - 每个 UI 控件是否有对应实现（按钮、开关、下拉框）
   - 每个控件是否接入了 store / 产生了实际效果
   - 编辑器中的标注渲染是否与原版视觉一致（颜色、标签、位置）
   - 交互行为是否一致（点击、右键、悬停）
4. 只有全部比对通过，才可宣布 Phase 完成

### 教训记录

- **M4 Phase 2 遗漏**：只关注 CM6 底层架构（StateField/装饰系统），忽略了原版 "node" 模式（Color + ID 标签显示）、Tag 列表颜色同步、Toolbar 开关绑定。原因是没有逐功能比对原版，仅凭"编译通过 + 测试通过"就判定完成。

---

## Session 1.1

**时间**: 2026-02-11
**分支**: jay-dev
**主要目标**: 项目启动、结构规划、React项目初始化

### 完成的工作

1. **重构计划评估与优化**
   - 分析了现有代码库：35个JS文件(18,807行)、23个HTML模板(11,031行)
   - 识别关键模块：app_hotpot.js(3,795行)、13个扩展模块(~6,500行)、4个解析器
   - 优化work.md中的重构计划：
     - 调整模块顺序：将M5解析器模块提前到M3（纯函数，易于迁移）
     - 延长M7注释编辑器时间：8天 → 15天（复杂度被低估）
     - 总时间线：12周 → 18周（更现实）

2. **目录结构决策**
   - 评估了两种方案：A) 重组为original/ + react-app/ + shared/，B) 保持原样 + MedTator-React/
   - 选择方案B：保持原始代码不变，避免破坏Flask路径、维护git历史、便于上游同步
   - 最终结构：
     ```
     MedTator/  (Git根目录)
     ├── web.py               # Flask开发服务器
     ├── config.py            # 配置文件
     ├── templates/           # 原版前端代码
     │   ├── js/              # 35文件, 18807行
     │   └── _annotator_*.html
     └── MedTator-React/      # React版本（新建）
     ```

3. **环境验证**
   - 验证Flask 3.1.2服务器正常运行（localhost:8086）
   - 确认Node.js v22.16.0 + npm 8.5.2可用

4. **React项目初始化**
   - 使用Vite 7.3.1创建React 18 + TypeScript项目
   - 命令: `npm create vite@latest MedTator-React -- --template react-ts`
   - 安装了176个依赖包
   - 验证Vite开发服务器正常运行（localhost:5173）
   - Git提交: "vite init" (e9c5464)

### 关键技术决策（已在Session 1.2中简化）

- **技术栈**: React 18 + TypeScript + Vite + Ant Design + Zustand + Electron
- **开发策略**:
  - 原始代码库保持不变，仅创建新React应用
  - brat可视化库直接包装，不重写
  - Electron替代浏览器File System Access API
  - 不用React Router，state切Tab
  - 不搞ESLint/Prettier/测试
- **时间规划**: 8个模块(M1-M8)，8周开发周期

### 技术问题与解决

**问题**: Vite创建项目时路径拼接错误
- 错误: `mkdir 'C:\...\MedTator\C:\...\MedTator\MedTator-React'`
- 解决: 使用`cd`命令 + 相对路径：`cd "C:\...\MedTator" && npm create vite@latest MedTator-React -- --template react-ts`

### 工作模式评价

用户采用了专业的项目管理方法：
- 先规划后编码
- 要求审查后再执行
- 质疑建议并提出替代方案
- 验证驱动的开发流程
- 使用Git检查点管理版本

### 下一步

继续M1项目设置，安装Ant Design + Zustand，搭建Tab切换布局。

---

## Session 1.2

**时间**: 2026-02-11
**主要目标**: 架构简化

### 变更

用户明确需求：**功能一样、能用、打包成桌面App**。不要过度设计。

**砍掉的**：
- React Router → state切Tab
- ESLint + Prettier → 不搞
- 单元测试 + E2E → 不写
- 性能优化（虚拟列表等）→ 先能用
- 多slice状态管理 → 一个store.ts
- 深层目录嵌套 → 扁平components/

**新增的**：
- Electron桌面打包（替代浏览器File System Access API）

**精简结果**：
- 模块：15个 → 8个
- 周期：18周 → 8周
- 目录层级：3-4层 → 2层
- work.md 改名为 reload.md

---

## Session 1.3

**时间**: 2026-02-11
**主要目标**: M1收尾（调试空白页、原版深度分析、更新reload.md）

### 完成的工作

1. **修复Vite空白页问题**
   - 现象：`npm run dev` 无报错，但 localhost:5174 页面空白
   - 浏览器控制台报错：`RibbonMenu.tsx:11 Uncaught SyntaxError: The requested module '/src/store.ts' does not provide an export named 'TabKey'`
   - 原因：Vite/esbuild 会剥离 `export type` 声明，`import { useAppStore, TabKey }` 在运行时找不到 TabKey
   - 修复：将 `import { useAppStore, TabKey }` 拆为 `import { useAppStore }` + `import type { TabKey }`
   - 结果：界面正常显示，7个Tab切换正常

2. **原版Flask项目深度分析**
   - Flask服务器（web.py）几乎无用：只有一个路由 `/`，渲染index.html + 注入sample数据，无后端API
   - Vue实例（app_hotpot.js）：巨型对象，vpp_data含30+属性，Tab切换用 `v-show`
   - 文件操作（fs_helper.js）：浏览器 File System Access API（showOpenFilePicker/showSaveFilePicker）
   - 7个ext模块对应7个Tab，行数从75行（export）到1314行（error analysis）
   - 4个解析器是纯函数无DOM依赖，最适合先移植

3. **更新reload.md架构设计**
   - 新增原版架构深度分析（Flask角色、vpp_data详情、ext模块表格、数据流图）
   - 更新M1任务状态（标记已完成项、Electron推迟到M7）
   - 调整M3策略（先用浏览器file input，不依赖Electron）
   - 添加Session 1.3开发日志

### 技术问题与解决

**问题**: `export type` 在Vite中的import方式
- Vite使用esbuild做转译，esbuild在处理TypeScript时会剥离type-only exports
- 必须使用 `import type { X }` 而非 `import { X }` 来导入纯类型
- 这是TypeScript + esbuild的已知行为

### 当前文件状态

- `RibbonMenu.tsx` — 修复了TabKey导入方式
- `store.ts` — Zustand store，含TabKey类型 + AppState（currentTab, dtd, anns, annIdx, cm）
- `App.tsx` — 主组件，7个Tab条件渲染
- `components/` — 8个组件文件（RibbonMenu + 7个Tab占位组件）
- `reload.md` — 更新了架构分析和M1状态

### 下一步

M2-解析器移植（已在Session 2.1完成）

---

## Session 2.1

**时间**: 2026-02-11
**主要目标**: M2-解析器移植 + Annotation Tab布局对齐

### 完成的工作

1. **Annotation Tab 布局对齐原版**
   - 对照原版Flask截图，重写 `Annotation.tsx`
   - 工具栏Ribbon：8个分组（Schema File / Annotation File / Display Mode / Search / Entity Marks / Link Marks / Hint Marks / Help）
   - 上半区(60%)：文件列表面板(250px, Sort/Filter/分页) + CodeMirror编辑器占位
   - 下半区(40%)：Tag定义列表(Entity Tags + Link Tags) + 标注表格(Tag/ID/Spans/Text/Attributes)
   - 纯布局骨架，功能后续接入

2. **M2-解析器移植（4个parser → TypeScript）**
   - 读完原版4个JS解析器（共2966行），分析依赖关系
   - 新建 `types.ts`：共享类型定义（Dtd, DtdTag, DtdAttr, Ann, AnnTag, BratDocData, BratColData等）
   - `parsers/dtd-parser.ts` ← dtd_parser.js (1092行)：Schema解析（DTD/JSON/YAML三种格式）+ 序列化
   - `parsers/ann-parser.ts` ← ann_parser.js (1085行)：标注XML解析/序列化 + Hint字典 + span/loc工具函数
   - `parsers/brat-parser.ts` ← brat_parser.js (560行)：BRAT格式转换 + 颜色管理 + collection/document数据
   - `parsers/bioc-parser.ts` ← bioc_parser.js (229行)：BioC XML生成/导出
   - 安装依赖：js-yaml + @types/js-yaml
   - TypeScript编译零错误

3. **迁移技术处理**
   - `var` → `const`/`let`，添加TypeScript类型
   - `.contains()` → `.includes()`（原版用了非标准方法）
   - `typeof(x)=='undefined'` → 默认参数
   - 对象方法模式 → 导出函数
   - `require('xml-formatter')` → 简单内联格式化
   - `saveAs()` (FileSaver全局) → 原生 `URL.createObjectURL` 下载
   - `jsyaml` 全局变量 → `import yaml from 'js-yaml'`
   - 跳过 `pretty_xml_str`（依赖jQuery）和 `get_subtags_of_substr_in_ann`（依赖nlp_toolkit），后续需要时再加

### Parser在项目中的角色

```
用户拖入.dtd → dtd-parser.parse() → store.dtd → 所有Tab可工作
用户拖入.xml → ann-parser.xml2ann() → store.anns → 文件列表/编辑器显示
编辑器可视化 → brat-parser.makeDocumentData() → BRAT渲染
导出BioC → bioc-parser.anns2xml() → 下载XML
```

Parser是数据入口，M3接上文件操作后整个数据流就通了。

4. **引入单元测试（Vitest + jsdom）**
   - 安装 vitest + jsdom（happy-dom 不支持 XML DOM，已卸载）
   - vite.config.ts 添加 `test: { environment: 'jsdom' }`
   - package.json 添加 `npm test`（单次）和 `npm run test:watch`（监听模式）
   - 4个测试文件，67个测试全部通过：
     - `dtd-parser.test.ts`（17个）：DTD/JSON/YAML解析、roundtrip、工厂函数、边界情况
     - `ann-parser.test.ts`（30个）：span工具、xml2ann、ann2xml roundtrip、tag工具、hint字典、hash
     - `brat-parser.test.ts`（14个）：颜色管理、parseAnn、collection/document数据、medtagger
     - `bioc-parser.test.ts`（6个）：BioC XML生成、entity/relation/多文档/空列表
   - sample/ 目录的真实 DTD 数据也通过了验证

### 当前文件状态

```
MedTator-React/src/
├── App.tsx              # 主组件，7个Tab条件渲染
├── main.tsx             # 入口
├── store.ts             # Zustand store
├── types.ts             # ✅ 新增：共享类型定义
├── index.css            # 全局样式
├── components/
│   ├── RibbonMenu.tsx   # 顶部Tab菜单
│   ├── Annotation.tsx   # ✅ 重写：对齐原版布局（Ribbon+文件列表+编辑器+Tag列表+标注表格）
│   ├── Statistics.tsx   # 占位
│   ├── Export.tsx       # 占位
│   ├── Adjudication.tsx # 占位
│   ├── Converter.tsx    # 占位
│   ├── ErrorAnalysis.tsx# 占位
│   └── Toolkit.tsx      # 占位
└── parsers/             # ✅ 新增：4个解析器
    ├── dtd-parser.ts    # Schema解析（DTD/JSON/YAML）
    ├── ann-parser.ts    # 标注XML解析/序列化
    ├── brat-parser.ts   # BRAT格式转换
    ├── bioc-parser.ts   # BioC XML生成
    └── __tests__/       # ✅ 新增：单元测试（67个，全部通过）
        ├── dtd-parser.test.ts
        ├── ann-parser.test.ts
        ├── brat-parser.test.ts
        └── bioc-parser.test.ts
```

### M2 代码审查与修复

对照原版4个JS文件逐函数对比，发现并修复了以下问题：

**dtd-parser.ts：**
- `NON_CONSUMING_SPANS` 未导出 → 加 `export`（其他模块需要引用）
- `getAttrRequire()` 只取第一个正则匹配 → 改为循环取最后一个（和原版while循环行为一致）
- `parseTmpDtd()` / `mkAttrByTmpAttr()` 用 truthiness 检查 → 改用 `hasOwnProperty`（避免空字符串被误拒）

**ann-parser.ts：**
- `ann2xml` 空meta也生成 `<META></META>` → 加 `Object.keys().length > 0` 守卫
- 缺 `get_subtags_of_substr_in_ann` → 遗留到M4（依赖nlp_toolkit，brat句子级可视化时实现）

**brat-parser.ts：**
- 缺 `ann2brat()` 函数 → 补上stub（原版也未完成，保留TODO）
- `medtagger2brat` 多了 `&& r.certainty` 守卫 → 去掉（改变了属性ID编号）
- emoji glyph 被换成ASCII → 恢复 `➕➖❓`
- `getColor` / `normDict` 用 falsy 检查 → 改用 `hasOwnProperty`
- 清理未使用的 import（`Ann`, `BratEntity`）

**审查确认的改进（保留）：**
- `mkBaseTag` 的 `id_prefix` 从 `{}` 改为 `''` — 修复原版bug
- 多处加了null守卫 — 防御性改进，静默跳过而非崩溃
- `getLocs` 不再为捕获组重复push — 修复原版潜在bug
- `.contains()` → `.includes()` — 修正非标准方法
- `innerHTML` → `textContent` — 更安全
- `makeCollectionDataByDtd` 关系类型字符串修复 `attrJ.name` 重复bug → 正确用 `attrK.name`

**已知遗留项：**
- `ann-parser.ts` 缺 `get_subtags_of_substr_in_ann`（M4实现，需要nlp_toolkit）
- `brat-parser.ts` 的 `ann2brat` 是stub（原版也未完成）
- `ann-parser.ts` 缺 `xml2str_v1` / `pretty_xml_str`（无调用者，安全省略）

### 下一步

M3-状态管理+文件操作：完善store.ts + 实现文件拖拽加载 → 打通parser到UI的数据流

---

## Session 3.1 — M3 Step 1: store.ts 状态设计

**时间**: 2026-02-12
**分支**: jay-dev
**模型**: Opus 4.6

### 完成的工作

1. **原版状态全量梳理**
   - 扫描 app_hotpot.js 的 vpp_data（30行~175行）+ 11个ext模块
   - 统计出原版共 96+ 个状态属性
   - 筛选出 M3 需要的 16 个属性 + 14 个 actions

2. **重写 store.ts（40行 → 169行）**
   - 用 `types.ts` 的真实类型（`Dtd`, `Ann`）替代 `any`
   - 新增导出类型：`SortAnnsBy`（6种排序）、`CmSettings`（7个编辑器选项）

   **状态分组：**
   | 分组 | 属性 | Actions |
   |------|------|---------|
   | Tab | `currentTab` | `setCurrentTab` |
   | Schema | `dtd` | `setDtd` |
   | 标注文件 | `anns`, `annIdx` | `setAnns`, `setAnnIdx`, `addAnns`, `removeAnn`, `clearAnns` |
   | 文件列表 | `sortAnnsBy`, `fnPattern`, `pgIndex`, `pgNumPerPage` | `setSortAnnsBy`, `setFnPattern`, `setPgIndex` |
   | Tag过滤 | `displayTagName` | `setDisplayTagName` |
   | 加载进度 | `isLoadingAnns`, `nAnnsDropped/Loaded/Error`, `msgLoadingAnns` | `startLoading`, `updateLoading`, `finishLoading` |
   | CM设置 | `cm`（7个选项） | `setCm` |

   **关键设计决策：**
   - `setAnns` 自动重置 `annIdx=0` + `pgIndex=0`
   - `addAnns` 增量追加不覆盖（适配异步批量加载）
   - `removeAnn` 自动修正 `annIdx`（删除后不越界）
   - 排序/过滤变更时自动 `pgIndex=0`
   - Loading 三阶段：`start` → `update` → `finish`
   - 未来模块状态（hints、linking、IAA、razer等）等到对应模块时再加

### 验证

- TypeScript 编译 ✅ 零错误
- IDE 诊断 ✅ 零问题
- 67个解析器测试 ✅ 全部通过
- 现有组件（RibbonMenu、App.tsx）不受影响

### 下一步

M3 Step 2: 文件操作（file-helper + 拖拽 + parser接入 + UI更新）— 切回 Sonnet

---

## Session 3.2 — M3 Step 2: 文件操作

**时间**: 2026-02-12
**分支**: jay-dev
**模型**: Sonnet 4.5

### 完成的工作

**1. 文件操作工具 (`utils/file-helper.ts`)**
- ✅ 创建 75 行工具模块，封装浏览器文件操作
- `readFileAsText()` - 读取单个 File 对象为文本
- `readFilesAsText()` - 批量读取多文件
- `filterFilesByExtension()` - 按扩展名过滤
- `isSchemaFile()` / `isAnnotationFile()` - 文件类型检查
- `downloadTextAsFile()` - 下载文件（预留导出功能用）

**2. Annotation.tsx 完整重写（305行 → 500+行）**

**新增 imports**：
- `useRef`, `useMemo` (React hooks)
- `message` (Ant Design 提示)
- `useAppStore` (Zustand 状态)
- `file-helper` 工具函数
- `parseDtd`, `xml2ann`, `txt2ann` (Parser 函数)

**ToolbarRibbon 重写**：
- Schema 文件区域：
  - 隐藏 `<input type="file" accept=".dtd,.json,.yaml,.yml">`
  - 拖拽区：支持 drag&drop，点击打开文件选择器
  - 加载后显示 `✓ SCHEMA_NAME`（绿色背景）
  - 错误处理：文件类型检查 + 解析失败提示
- Annotation 文件区域：
  - Schema 未加载时显示提示文字
  - Schema 加载后显示 "Load Files" 按钮
  - 支持多文件选择（`multiple` 属性）
  - 批量解析：显示 loading 进度（`startLoading → updateLoading → finishLoading`）
  - 错误计数：解析失败的文件单独统计

**FileListPanel 重写**：
- 工具栏：
  - 排序下拉框：6 种排序方式（default / alphabet / alphabet_r / tags / tags_r / label）
  - 过滤输入框：实时搜索文件名
  - "All" 按钮：清空过滤
- 文件列表：
  - 使用 `useMemo` 计算过滤+排序后的文件列表
  - 分页显示（每页 100 个）
  - 点击切换文件：`setAnnIdx()`
  - 选中状态：蓝色高亮 + 边框
- 分页控制：
  - 显示总文件数 + 当前页码
  - 上/下翻页按钮
  - 边界禁用

**EditorPanel 重写**：
- 当前文件存在 → 显示 `<textarea>` 展示文本（只读）
- 无文件 → 显示占位提示（EditOutlined 图标 + 文字）
- 暂时用 textarea 占位，后续替换为 CodeMirror

**TagListPanel 重写**：
- Header：
  - "All Tags" 可点击，显示总 Tag 数量
  - 点击后设置 `displayTagName='__all__'`
- Entity Tags 列表：
  - 显示每个 etag 的颜色方块 + 名称
  - 点击设置 `displayTagName=tag.name`
  - 选中状态：蓝色高亮
- Relation Tags 列表：
  - 同 Entity Tags
  - 分隔线分隔

**AnnotationTable 重写**：
- 使用 `useMemo` 根据 `displayTagName` 过滤当前文件的 tags
- 表头：Tag / ID / Spans / Text / Attributes（sticky 定位）
- 表体：
  - 显示过滤后的标注
  - Spans: 显示原始字符串（如 "15~21"）
  - Text: 限制宽度，超出省略号
  - Attributes: 排除内置字段（tag/id/spans/text/type），显示为 `key=value` 格式
- 空状态提示

**3. 数据流打通**

```
用户拖拽 .dtd
  ↓
handleSchemaFile() → readFileAsText()
  ↓
parseDtd(text, format) → Dtd 对象
  ↓
store.setDtd(dtd)
  ↓
UI 更新：Schema 区域显示绿色 ✓，Load Files 按钮启用

用户选择多个 .xml 文件
  ↓
handleAnnotationFiles() → startLoading(n)
  ↓
循环：readFileAsText() → xml2ann(text, dtd) → Ann 对象
  ↓
store.addAnns(newAnns) + finishLoading()
  ↓
UI 更新：文件列表显示、编辑器显示第一个文件、标注表格显示 tags

用户点击 Tag 列表
  ↓
store.setDisplayTagName(name)
  ↓
AnnotationTable useMemo 重新过滤 → 只显示匹配的 tags
```

**4. 修复 TypeScript 编译错误**
- `Annotation.tsx`: 移除未使用的 `Spin`, `SaveOutlined`, `DeleteOutlined`, `LoadingOutlined`, `SortAnnsBy` import
- `ann-parser.test.ts`: 移除未使用的 `AnnTag` import
- `bioc-parser.test.ts`: 移除未使用的 `Ann` import
- `ann-parser.ts`: `anns2hintDict` 的 `dtd` 参数改为 `_dtd`（保留接口兼容性）

**5. 测试文件生成**
- `test-schema.dtd` (33 行)：医学症状标注 Schema
  - 3 个 Entity: SYMPTOM, MEDICATION, DISEASE
  - 2 个 Relation: LK_SYMPTOM_DISEASE, LK_MED_DISEASE
  - 包含属性：certainty, severity, dosage, frequency, relation_type 等
- `test-annotation.xml` (16 行)：示例标注文件
  - 患者医疗记录文本（117 字符）
  - 5 个 Entity 标注（3 症状 + 1 药物 + 1 疾病）
  - 2 个 Relation 标注

**6. 功能验证（用户手动测试）**
- ✅ 拖拽加载 `test-schema.dtd` → 显示 `✓ MEDICAL_SYMPTOMS`（绿色）
- ✅ 点击 "Load Files" 加载 `test-annotation.xml` → 文件列表显示文件名
- ✅ 编辑器显示文本："Patient reports severe headache..."
- ✅ Tag 列表显示：Entity Tags (3) + Relation Tags (2)
- ✅ 标注表格初始显示 3 个 SYMPTOM 标注
- ✅ 点击 "All Tags" → 显示全部 7 个标注（3 症状 + 1 药物 + 1 疾病 + 2 关系）
- ✅ Spans / Text / Attributes 正确解析显示

### 验证

- TypeScript 编译 ✅ 零错误
- 67 个 parser 测试 ✅ 全部通过
- Vite build ✅ 成功（696KB bundle）
- 开发服务器 ✅ 正常运行（http://localhost:5173）
- 功能测试 ✅ Schema 加载、Annotation 加载、Tag 过滤、文件切换全部正常

### 关键设计决策

1. **暂时不用 CodeMirror**：编辑器用 `<textarea>` 占位，M4 再集成 CodeMirror + 标注功能
2. **Tags/Tags_r/Label 排序未实现**：文件列表的这 3 种排序逻辑复杂，标记 TODO 留待需要时实现
3. **Loading 三阶段**：异步加载大量文件时，实时反馈进度和错误数
4. **Parser 错误捕获**：单个文件解析失败不阻断其他文件，错误单独计数
5. **useMemo 优化**：文件列表过滤/排序、标注过滤使用 useMemo 避免重复计算

### 文件变更统计

- **新增**: `utils/file-helper.ts` (75 行)
- **新增**: `test-schema.dtd` (33 行)
- **新增**: `test-annotation.xml` (16 行)
- **修改**: `components/Annotation.tsx` (305 行 → 500+ 行，核心逻辑重写)
- **修改**: `parsers/ann-parser.ts` (1 行，参数重命名)
- **修改**: `parsers/__tests__/ann-parser.test.ts` (1 行，移除未使用 import)
- **修改**: `parsers/__tests__/bioc-parser.test.ts` (1 行，移除未使用 import)

### 当前项目状态

**M3-状态管理 + 文件操作 (3天)**：
- [x] Step 1: store.ts 完善（16 个状态 + 14 个 actions）✅ 2026-02-12
- [x] Step 2: 浏览器文件操作（Schema/Annotation 加载 + 拖拽 + UI 更新）✅ 2026-02-12
- [ ] Step 3: ZIP 打包（JSZip - 可选，看需求）

**进度**: M3 完成 2.5/3，约 **83%**

### 下一步选择

**选项 1**: M3 Step 3 - ZIP 打包功能（批量加载/保存 .zip 压缩包）
**选项 2**: 跳过 ZIP，直接进入 M4 - 标注编辑器（CodeMirror 集成 + 实体标注 + 关系标注）

建议：**先 Git commit 保存进度，然后根据需求决定是否做 ZIP 功能**

---

## Session 3.3 — M3 完成 + 进入 M4

**时间**: 2026-02-12
**分支**: jay-dev
**模型**: Sonnet 4.5

### 决策：跳过 M3 Step 3

**原因**：
- M4 标注编辑器是核心功能（12 天大模块），优先级更高
- 当前多文件选择功能已足够（可一次选择多个 .xml 文件）
- ZIP 功能可在核心功能完成后补充（非阻塞）

**M3 最终状态**：
- [x] Step 1: store.ts 完善 ✅
- [x] Step 2: 文件操作（Schema/Annotation 加载） ✅
- [~] Step 3: ZIP 打包 - **跳过，延后**

**进度**: M3 核心功能完成 **100%**（Step 3 为可选功能）

### 下一步

进入 **M4 - 标注编辑器**

---

## Session 4.1 — M4 Phase 1: Store 扩展 + Tag Helper

**时间**: 2026-02-12
**分支**: jay-dev
**模型**: Sonnet 4.5
**提交**: 8abb46a

### 完成的工作

**1. 新建 `utils/tag-helper.ts`（98行，从 app_hotpot.js 3348-3435行移植）**

- `makeEtag(basicTag, tagDef, ann)` — 创建实体标注（自动递增ID + 默认属性值）
- `makeEmptyEtagByDef(tagDef)` — 文档级标注（spans="-1~-1"，non-consuming）
- `makeEmptyRtagByDef(tagDef)` — 空关系标注（所有属性设为空字符串）
- `getIdrefAttrs(rtagDef)` — 从 rtag 定义中筛选 vtype=idref 的属性列表

**2. 扩展 store.ts（169行 → 298行）**

新增3组状态+actions：

| 分组 | 状态 | Actions |
|------|------|---------|
| Tag操作 | — | `addTag(tag)`, `removeTag(tagId)`, `updateTagAttr(tagId, attr, value)`, `setAnnSaved()`, `setAnnUnsaved()` |
| Tag选择 | `selectedTagId` | `setSelectedTagId(tagId)` |
| 关系链接状态机 | `isLinking`, `linkingTagDef`, `linkingTag`, `linkingAtts` | `startLinking(rtagDef, firstEntityId)`, `setLinking(attIndex, entityId)`, `doneLinking()`, `cancelLinking()` |

关键设计：
- `addTag` 同时设置 `_saved = false`（标记文件 unsaved）
- `removeTag` 同时删除引用该 tag 的 rtag（级联删除）
- `doneLinking` 构造 rtag 后调用 `addTag`，然后重置 linking 状态
- `cancelLinking` 仅重置状态，不做任何修改

**3. 单元测试 `utils/__tests__/tag-helper.test.ts`（8个测试）**

覆盖：makeEtag ID自动递增、默认属性填充、makeEmptyEtagByDef spans="-1~-1"、makeEmptyRtagByDef 属性为空、getIdrefAttrs 过滤

### 验证

- TypeScript 编译 ✅ 零错误
- 75 个测试 ✅ 全部通过（67 旧 + 8 新）
- Git 提交 ✅ 8abb46a

---

## Session 4.2 — M4 Phase 2: CodeMirror 6 核心集成

**时间**: 2026-02-12
**分支**: jay-dev
**模型**: Opus 4.6
**状态**: 代码完成，待提交

### 完成的工作

**1. 安装 CM6 依赖**
```
@codemirror/state @codemirror/view @codemirror/search @codemirror/commands
```

**2. 新建 `editor/cm-spans.ts`（~40行）**
- `spansToCmRanges(spans)` — 解析 "10~20,30~40" 为 `{from, to}[]`
- `cmRangeToSpans(from, to)` — 转回 spans 字符串
- CM6 用绝对字符偏移，比 CM5 的 line+ch 更简单，无需行列转换

**3. 新建 `editor/cm-decorations.ts`（~150行）**

两个独立的 StateField 装饰层：

| Field | Effect | 作用 |
|-------|--------|------|
| `tagDecorationField` | `setTagDecorations` | 所有可见实体标注 → `Decoration.mark({ class: 'mark-tag mark-tag-{TAG}' })` |
| `selectedTagField` | `setSelectedTag` | 选中标注高亮 → `Decoration.mark({ class: 'mark-tag-active' })` |

关键逻辑：
- 显示过滤：`displayTagName !== '__all__'` 时只渲染匹配的 etag
- rtag 关联：当过滤条件是 rtag 时，也显示被该 rtag 引用的 etag
- 跳过无效 spans（空字符串、"-1~-1"、超出文档范围）
- CM6 要求装饰范围排序，用 `ranges.sort()` + `Decoration.set(ranges, true)`

**4. 新建 `editor/cm-theme.ts`（~165行）**

三部分：

- **`annotationTheme`**（CM6 EditorView.theme）：
  - `.mark-tag` — 圆角3px、pointer cursor、透明边框（hover变红）
  - `.mark-tag-active` — 3px黑色上下边框 + glow动画
  - `.mark-hint` — 虚线下划线、hover加粗

- **`assignTagColors(dtd)`**（在 `setDtd` 之前调用）：
  - 24色调色板（从原版 app_hotpot.js 的 `app_colors` 移植）
  - 遍历 `dtd.tag_dict`，为每个未着色的 tag 分配颜色
  - **必须在 `setDtd()` 之前调用**，否则 store 中的 dtd 没有颜色信息

- **`injectTagColors(dtd)`**（DTD 变化时调用）：
  - 注入 `<style>` 元素，生成 `.mark-tag-{TAG} { background-color: ... }` 规则
  - 同时注入全局静态样式（glow 动画 + node 模式 `::before` 伪元素）

**5. 新建 `editor/cm-setup.ts`（~23行）**
- `createEditorExtensions()` → 返回 Extension 数组
- 包含：readOnly、lineNumbers、lineWrapping、search + searchKeymap、annotationTheme、两个 StateField

**6. 新建 `components/AnnotationEditor.tsx`（~145行）**

CM6 React 封装：
- `useRef<EditorView>` 管理实例
- **始终挂载容器 div**（用 `visibility: hidden` + 绝对定位 overlay 处理空状态）
- 3 个 useEffect：
  - `[]` — 初始化 CM6 实例（一次性）
  - `[dtd]` — DTD 变化时注入 tag 颜色
  - `[anns, annIdx, dtd, displayTagName, selectedTagId]` — 更新文档 + 派发装饰 Effect
- 外层 div 根据 `cm.markMode` 添加 `mark-mode-node` / `mark-mode-span` 类

**7. 修改 `components/Annotation.tsx`**

- 删除旧的 `EditorPanel`（textarea 占位），替换为 `<AnnotationEditor />`
- Schema 加载流程：`assignTagColors(parsed)` → `setDtd(parsed)`（确保颜色先写入）
- 工具栏控件全部绑定到 store：
  - Display Mode → `cm.displayMode`
  - Entity Marks → `cm.markMode`（"node" / "span"）
  - Link Marks → `cm.enabledLinks` / `cm.enabledLinkComplex`
  - Hint Marks → `cm.enabledHints` / `cm.hintMode`

**8. 修复 `test-annotation.xml` spans 偏移**
- 所有 spans 向右修正 +1（原来 off-by-one）
- 例：severe 15~21 → 16~22，headache 22~30 → 23~31

### 问题与修复

| 问题 | 原因 | 修复 |
|------|------|------|
| 所有标注显示黑色 | DTD 默认颜色 #333333，未分配调色板颜色 | 新增 `assignTagColors()`，在 `setDtd` 前调用 |
| 标注高亮左偏一个字符 | test-annotation.xml spans 数值错误 | 重新计算正确的字符偏移 |
| `DecorationSet` 导入报 TS1484 | verbatimModuleSyntax 要求 type-only import | `import { Decoration, type DecorationSet }` |
| 遗漏 Color+ID 模式 | 只关注 CM6 底层，没比对原版 UI | 用 CSS `::before { content: attr(data-tag-id) }` + wrapper class 控制 |
| Tag 列表颜色方块黑色 | 颜色在 `injectTagColors` 里赋值，但 store 里的 dtd 已经存了 | 拆分：`assignTagColors` 先改 dtd → `setDtd` 存入 store → `injectTagColors` 生成 CSS |
| 工具栏开关未绑定 store | 控件写了但没接 `onChange` | 所有 Radio.Group/Switch 绑定 `setCm()` |

### 验证

- TypeScript 编译 ✅ 零错误
- 75 个测试 ✅ 全部通过
- 浏览器测试 ✅：
  - 加载 test-schema.dtd → 显示 `✓ MEDICAL_SYMPTOMS`
  - 加载 test-annotation.xml → 编辑器显示彩色标注高亮
  - Tag 列表颜色方块正确显示
  - Entity Marks 切换 Color+ID / Color Only 正常
  - 标注位置与文本对齐

### 文件变更统计

| 文件 | 状态 | 行数 |
|------|------|------|
| `editor/cm-spans.ts` | 新增 | ~40 |
| `editor/cm-decorations.ts` | 新增 | ~150 |
| `editor/cm-theme.ts` | 新增 | ~165 |
| `editor/cm-setup.ts` | 新增 | ~23 |
| `components/AnnotationEditor.tsx` | 新增 | ~145 |
| `components/Annotation.tsx` | 修改 | 删除 EditorPanel + 添加 CM6 集成 + 工具栏绑定 |
| `test-annotation.xml` | 修复 | spans 偏移修正 |

### 下一步

Phase 3: 右键菜单 + 实体创建（推荐 Sonnet）

---

## Session 4.3 — M4 Phase 3: 右键菜单 + 实体创建

**时间**: 2026-02-13
**分支**: jay-dev
**模型**: Sonnet 4.5
**状态**: 代码完成，待提交

### 完成的工作

**1. 新建 `ContextMenu.tsx`（156行）**
- React Portal 实现浮层定位（fixed positioning）
- 显示 Entity Tags 列表（颜色方块 + 名称 + 快捷键）
- Escape / 点击外部自动关闭
- 菜单溢出视口时自动调整位置

**2. 修改 `AnnotationEditor.tsx`**
- 集成 `EditorView.domEventHandlers`：
  - **contextmenu**: 选中文本右键 → 显示菜单（selection.from !== selection.to）
  - **mousedown**: 点击标注 → 设置 selectedTagId（检测 `data-tag-id` 属性）
- `handleTagSelect`: 菜单点击 → `cmRangeToSpans` → `makeEtag` → `addTag` → 清除 CM6 选择
- 渲染 `<ContextMenu>` 组件

**3. 修改 `Annotation.tsx`**
- AnnotationTable 添加 useRef + useEffect：标注数量变化时自动滚动到底部
- 添加 useEffect import

### 数据流

```
用户选中文本 "Blood pressure"
  ↓
右键 → contextmenu 事件 → 记录 selection { from: 75, to: 89 }
  ↓
显示 ContextMenu（3个 Entity Tags）
  ↓
点击 SYMPTOM
  ↓
cmRangeToSpans(75, 89) → "75~89"
  ↓
makeEtag({ spans: "75~89", text: "Blood pressure" }, SYMPTOM_def, ann)
  ↓
store.addTag(tag) → anns[annIdx].tags.push + _saved=false
  ↓
useEffect 触发 → CM6 dispatch setTagDecorations → 彩色高亮出现
  ↓
AnnotationTable useEffect 触发 → scrollTop = scrollHeight
```

### 功能对照原版

| 功能 | 原版 | 实现 | 状态 |
|------|------|------|------|
| 选中文本右键显示菜单 | ✅ | ✅ | ✅ |
| 菜单颜色方块 + 快捷键 | ✅ | ✅ | ✅ |
| 点击菜单创建标注 | ✅ | ✅ | ✅ |
| 创建后清除选择 | ✅ | ✅ | ✅ |
| 创建后关闭菜单 | ✅ | ✅ | ✅ |
| 创建后滚动表格到底部 | ✅ | ✅ | ✅ |
| Escape/点击外部关闭 | ✅ | ✅ | ✅ |
| 点击标注高亮 | ✅ | ✅ | ✅ |
| **快捷键创建标注** | ✅ | ❌ | ⏸️ Phase 7 |
| **点击标注显示菜单** | ✅ | ❌ | ⏸️ Phase 5 |

**核心功能完成度: 100%**

### 验证

- ✅ TypeScript 编译零错误
- ✅ 75 个测试通过
- ✅ 浏览器测试（用户确认）：右键菜单弹出 → 选择 tag → 标注显示

### 下一步

Phase 4: 标注表格交互增强（推荐 Sonnet）

---

## M4 架构计划 — 标注编辑器（剩余 Phase）

### 7 个 Phase 进度

- [x] Phase 1: Store 扩展 + Tag Helper ✅ (8abb46a)
- [x] Phase 2: CM6 核心集成 ✅ (9984b6b)
- [x] Phase 3: 右键菜单 + 实体创建 ✅ (待提交)
- [ ] Phase 4: 标注表格交互增强
- [ ] Phase 5: 关系标注链接
- [ ] Phase 6: 关系连线渲染
- [ ] Phase 7: 保存 + 收尾

---

#### Phase 3: 右键菜单 + 实体创建

**目标**：选中文本 → 右键 → 选标签类型 → 创建标注

**`components/ContextMenu.tsx`**：
- 浮层组件，React Portal 定位到鼠标坐标
- 选中文本右键 → 列出 dtd.etags（颜色图标 + 名称 + 快捷键）
- 点击标记右键 → 列出关系类型 + 删除选项
- Escape / 点击外部关闭

**创建流程**：
```
CM6 selection → cmRangeToSpans(from, to) → spans字符串
→ makeEtag(basicTag, tagDef, currentAnn) → AnnTag
→ store.addTag(tag) → useEffect 触发装饰重建
```

**CM6 事件绑定**：
- `EditorView.domEventHandlers({ contextmenu, mousedown })`
- contextmenu：阻止默认，显示菜单
- mousedown：检测 data-tag-id 属性，设置 selectedTagId

**验证**：选文本 → 右键 → 创建实体 → 编辑器和表格都显示新标注

---

#### Phase 4: 标注表格交互增强

**目标**：内联属性编辑 + 点击跳转 + 删除

**从 Annotation.tsx 增强 AnnotationTable**：
- 属性列根据 DtdAttr.vtype 渲染不同控件：
  - `list` → `<Select>` + attr.values
  - `text` → `<Input>`
  - `idref` → `<Select>` 列出当前文件所有实体标注
- 修改属性 → `store.updateTagAttr()`
- 点击行 → CM6 `scrollIntoView` + `setSelectedTagId`
- 删除按钮 → 检查关联 rtags → `Modal.confirm()` → `store.removeTag()`
- 双向高亮：selectedTagId 同时影响编辑器和表格

**验证**：修改属性 → 文件标记 unsaved。点击行 → 编辑器滚动。删除 → 表格和编辑器同步。

---

#### Phase 5: 关系标注链接 ⭐ 复杂状态机

**目标**：两阶段创建关系标注

**流程**：
1. 点击实体标记 → 弹出菜单显示可用关系类型
2. 选择关系类型 → `startLinking(rtagDef, entityId)`
3. 编辑器顶部显示链接指示条："Creating [RelType] — click next entity for arg1"
4. 点击第二个实体 → `setLinking(0, entityId)`
5. 如果还有更多 IDREF 属性 → 继续；否则 → `doneLinking()`
6. 关系标注添加到 tags 数组

**UI**：
- 链接进行中显示浮动横幅
- 菜单在链接模式下显示剩余属性 + 取消按钮
- `cancelLinking()` 重置所有状态

**验证**：创建两个实体 → 点击第一个 → 选关系类型 → 点击第二个 → 关系出现在表格

---

#### Phase 6: 关系连线渲染

**目标**：SVG 连线显示实体间关系

- 绝对定位 SVG 覆盖在 CM6 上方（pointerEvents: none）
- `view.coordsAtPos()` 获取实体标记位置
- 绘制 polyline 连线 + 中点标签文字
- 响应滚动和 resize 重新计算
- 工具栏开关：Show Links / Show Lines

**验证**：创建关系 → 连线出现。滚动 → 连线跟随。关闭开关 → 连线消失。

---

#### Phase 7: 保存 + 收尾

**目标**：文件保存 + 快捷键 + UI 打磨

- Save 按钮：`ann2xml(ann, dtd)` → `xml2str()` → `downloadTextAsFile()`
- Ctrl+S 快捷键
- 文件列表 unsaved 标记（文件名前加 * 号）
- Tag 快捷键（dtd.etags[i].shortcut → 选中文本时按键创建标注）
- 标注颜色动态生成 CSS

**验证**：修改标注 → * 号出现 → 保存 → 下载 XML → 重新加载验证内容一致

---

### 模型分配

| Phase | 模型 | 原因 |
|-------|------|------|
| Phase 1: Store + Helpers | Sonnet | 纯函数移植 + store 扩展，逻辑明确 |
| Phase 2: CM6 核心 | **Opus** | 架构最复杂：StateField、装饰系统、React 集成 |
| Phase 3: 右键菜单 + 实体创建 | Sonnet | UI 组件 + 事件绑定，模式已定 |
| Phase 4: 表格交互 | Sonnet | 表单控件 + 事件处理 |
| Phase 5: 关系链接 | **Opus** | 多步状态机，交互复杂 |
| Phase 6: 关系连线 | Sonnet | SVG 绘制，逻辑清晰 |
| Phase 7: 保存 + 收尾 | Sonnet | 功能明确，组合已有工具 |

### 验证策略

每个 Phase 完成后：
1. `npm run build` — TypeScript 编译零错误
2. `npm test` — 67 个旧测试 + 新测试全部通过
3. `npm run dev` — 浏览器手动测试（加载 test-schema.dtd + test-annotation.xml）
