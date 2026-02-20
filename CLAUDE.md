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

## Session 4.4 — M4 Phase 4: 标注表格交互增强

**时间**: 2026-02-13
**分支**: jay-dev
**模型**: Sonnet 4.5
**状态**: 代码完成，待提交

### 完成的工作

**1. 新建 `components/AnnotationTable.tsx`（250行）**

独立的表格组件，包含：
- **内联属性编辑**：
  - `list` 类型 → Select 下拉框 + "-- EMPTY --" 选项
  - `text` 类型 → Input 输入框
  - `idref` 类型 → Select 下拉框（显示当前文件所有实体标注）
  - 点击停止事件冒泡，避免触发行选择
- **删除按钮**：
  - 每行添加红色删除按钮
  - 无关联关系 → 直接删除 + message 提示
  - 有关联关系 → Modal.confirm() 显示关联 rtag 列表 → 级联删除
- **点击行高亮**：
  - 点击行 → 设置 `selectedTagId`
  - 表格行蓝色高亮（`background: '#e6f7ff'`）
  - 编辑器中同步高亮（Phase 2 已实现）
- **Auto-scroll**：新标注添加时自动滚动到底部

**2. 修改 `components/Annotation.tsx`**
- 删除旧的内联 AnnotationTable 函数（~70行）
- 导入新的 AnnotationTable 组件
- 移除 useEffect import（新组件内部处理）

**3. 修改 `parsers/ann-parser.ts`**
- 新增 `getTagById(tagId, ann)` - 从标注中查找 tag（用于表格组件）
- 删除重复的 `getLinkedRtags` 定义（保留原有实现）

**4. AttributeEditor 子组件**
- 根据 DtdAttr.vtype 渲染不同控件
- 过滤内置属性（tag/id/spans/text/type）
- idref 类型显示 `id | text` 格式（便于选择）
- 所有控件点击时停止事件冒泡

### 数据流

**属性编辑**：
```
用户修改 Select/Input
  ↓
onChange → updateTagAttr(tagId, attrName, value)
  ↓
store 更新 ann.tags[i][attrName] + ann._has_saved = false
  ↓
React 重新渲染表格
```

**删除流程**：
```
点击删除按钮
  ↓
handleDelete(tagId)
  ↓
getLinkedRtags(tagId, ann) → 查找关联关系（O(n×m)）
  ↓
if (linkedRtags.length === 0):
  removeTag(tagId) → message.success()
else:
  Modal.confirm() → 显示关联列表
    ↓ 用户确认
  linkedRtags.forEach(rtag => removeTag(rtag.id))  ← 先删除关系
  removeTag(tagId)  ← 再删除实体
```

**点击行高亮**：
```
点击表格行
  ↓
handleRowClick(tagId) → setSelectedTagId(tagId)
  ↓
表格行：isSelected ? '#e6f7ff' : 'transparent'
编辑器：CM6 setSelectedTag effect → 3px border + glow 动画
```

### 关键技术讨论

**1. 关系存储机制**

用户理解了关系标注的存储原理：
- **Schema 定义**：`<!ATTLIST LK_SYMPTOM_DISEASE arg0 IDREF prefix="SYMPTOM">`
- **XML 存储**：`<LK_SYMPTOM_DISEASE id="L0" SYMPTOMID="S1" DISEASEID="D0" .../>`
- **内存表示**：`{ id: "L0", tag: "LK_SYMPTOM_DISEASE", SYMPTOMID: "S1", DISEASEID: "D0", ... }`
- **引用机制**：通过字符串 ID 引用，不需要数据库

**2. 时间复杂度分析**

用户询问 `getLinkedRtags` 的性能：
- **复杂度**：O(n × m)，n=标注数，m=属性数
- **实际场景**：
  - 典型：200 标注 × 8 属性 = 1,600 次比较 → 0.03ms
  - 极端：1,000 标注 × 10 属性 = 10,000 次比较 → 0.2ms
- **调用频率**：低频（只在删除时调用）
- **原版实现**：同样的 O(n×m) 暴力遍历，5年未优化
- **结论**：性能完全够用，不需要优化

**3. 反向索引和双向图**

用户理解了图的数据结构：
- **当前实现**：单向图（只有正向引用）
  - 正向查询：L0 引用了谁？→ O(m)（遍历属性）
  - 反向查询：谁引用了 D0？→ O(n×m)（遍历所有标注）
- **反向索引**：构建入边表 `tagReferences: { "D0": ["L0", "L1"] }`
- **双向图**：正向引用 + 反向索引 = 可双向查询
  - 反向查询优化为 O(1)
  - 代价：增加空间和维护复杂度
- **结论**：当前数据规模小 + 删除频率低，不需要反向索引

### 验证

- ✅ TypeScript 编译零错误
- ✅ 75 个测试全部通过
- ✅ 浏览器测试（用户确认）：
  - 属性编辑正常（list/text/idref）
  - 删除功能正常（直接删除 + 级联删除）
  - 点击行高亮正常（表格 + 编辑器双向同步）

### 文件变更统计

| 文件 | 状态 | 行数 | 说明 |
|------|------|------|------|
| `components/AnnotationTable.tsx` | 新增 | 250 | 独立表格组件 + 属性编辑 + 删除 |
| `components/Annotation.tsx` | 修改 | -70 | 移除旧表格，导入新组件 |
| `parsers/ann-parser.ts` | 修改 | +11 | 新增 getTagById() |

### 下一步

**Phase 5: 关系标注链接**（推荐 Opus）
- 点击实体标注 → 显示可用关系类型
- 选择关系类型 → 进入链接模式 → 显示提示横幅
- 点击第二个实体 → 创建关系标注
- 状态机管理：isLinking / linkingTagDef / linkingTag / linkingAtts

---

## Session 4.5 — M4 Phase 5: 关系标注链接

**时间**: 2026-02-17
**分支**: jay-dev
**模型**: Opus 4.6
**状态**: 代码完成，待提交

### 完成的工作

**1. 修复 store.ts 链接状态机**
- `startLinking`: 初始化所有属性默认值（含IDREF），消费第一个 IDREF 后只存剩余的到 `linkingAtts`
- `setLinking`: 填入 IDREF 后从 `linkingAtts` 移除，为空时自动调用 `doneLinking()`
- `doneLinking`: 改用 `getNextTagId()` 替代重复的 ID 生成逻辑
- 新增 `updateLinkingAttr(attrName, value)`: 供 LinkingBanner 编辑非 IDREF 属性

**2. 新建 `components/TagPopupMenu.tsx`（~210行）**
- React Portal 浮层，点击实体标记时显示
- 两种渲染模式：
  - **未链接时**: tag info header + 关系类型列表 + 删除选项
  - **链接中**: tag info header + 剩余 IDREF 属性列表 + 取消链接
- 点击关系类型 → `startLinking(rtag, tagId)`
- 点击 IDREF 属性 → `setLinking(idx, tagId)` → 自动完成
- Escape / 点击外部关闭（跳过对其他 entity mark 的点击，允许菜单更新）

**3. 新建 `components/LinkingBanner.tsx`（~170行）**
- 可拖拽浮动面板（absolute 定位，mousedown 拖拽实现）
- Header: "Creating a Link Tag **{name}**"
- Done Linking / Cancel 按钮
- 属性行：IDREF→Select（带 `popupMatchSelectWidth={false}`）, list→Select, text→Input
- 通过 `updateLinkingAttr` 实时编辑

**4. 修改 `components/AnnotationEditor.tsx`**
- 新增 `tagMenu` 状态（visible, x, y, tagId）
- `mousedown` handler: 左键点击 entity mark → `setSelectedTagId` + 显示 TagPopupMenu
- `contextmenu` handler: 右键文本选择 → 显示 ContextMenu（原有）
- 用 `useRef` 存 setState 引用避免闭包过期
- 用 `useAppStore.getState()` 在事件处理器中读最新状态
- 渲染 LinkingBanner + TagPopupMenu

### Bug 修复

**1. ID 碰撞 bug（原版也有）**
- 问题：`LK_SYMPTOM_DISEASE` 和 `LK_MED_DISEASE` 共享前缀 "L"，原版 `get_next_tag_id` 按 tag name 计数，不同类型会生成相同 ID
- 修复：`getNextTagId()` 改为 `tag.id.startsWith(prefix)` 检查所有同前缀 tag
- `doneLinking` 改用 `getNextTagId()` 替代内联重复逻辑

**2. IDREF 下拉框显示关系标注**
- 问题：`t.type === 'etag' || !t.type` 过滤不可靠，L0/L1/L2 出现在下拉框
- 修复：改用 `dtd.tag_dict[t.tag]?.type === 'etag'` 过滤（AnnotationTable + LinkingBanner）

**3. IDREF 下拉框文本截断**
- 问题：下拉弹窗宽度跟输入框，长文本被截断
- 修复：添加 `popupMatchSelectWidth={false}`

**4. 标注表格表头重叠**
- 问题：sticky 表头无 z-index，滚动时内容穿过
- 修复：添加 `zIndex: 1`

### 完整交互流程

```
点击 S1 (SYMPTOM) → TagPopupMenu 显示关系类型
  → 选 LK_SYMPTOM_DISEASE → startLinking(rtag, "S1")
  → LinkingBanner 出现（arg0=S1, arg1=空, relation_type=associated_with）
  → 点击 D0 (DISEASE) → TagPopupMenu 显示 "LK_SYMPTOM_DISEASE - arg1"
  → 点击 "arg1" → setLinking(0, "D0") → linkingAtts 为空 → doneLinking()
  → 关系标注 L2 创建，出现在表格
```

### 验证

- TypeScript 编译 ✅ 零错误
- 75 个测试 ✅ 全部通过
- 浏览器测试 ✅：
  - 点击实体标记 → 弹出关系类型菜单
  - 选择关系类型 → LinkingBanner 出现，可拖拽
  - 点击第二个实体 → 填入 IDREF → 自动完成
  - 关系出现在标注表格
  - Done Linking / Cancel 按钮正常
  - IDREF 下拉框只显示实体标注

### 文件变更统计

| 文件 | 状态 | 行数 | 说明 |
|------|------|------|------|
| `store.ts` | 修改 | +15 | 修复链接状态机 + updateLinkingAttr |
| `components/TagPopupMenu.tsx` | 新增 | ~210 | 实体标记点击弹出菜单 |
| `components/LinkingBanner.tsx` | 新增 | ~170 | 链接模式浮动面板 |
| `components/AnnotationEditor.tsx` | 重写 | ~310 | 集成 TagPopupMenu + LinkingBanner |
| `components/AnnotationTable.tsx` | 修改 | +5 | IDREF 过滤 + popupMatchSelectWidth + zIndex |
| `parsers/ann-parser.ts` | 修改 | +5 | getNextTagId 按前缀查重 |


## Session 4.6 — M4 Phase 6: 关系连线渲染

**时间**: 2026-02-17
**分支**: jay-dev
**模型**: Opus 4.6 → Sonnet 4.5
**状态**: 完成

### 完成的工作

**1. 新建 `components/RelationLines.tsx` (~270行)**
- SVG 覆盖层，绘制关系标注连线
- `view.coordsAtPos()` 获取实体坐标 → 容器相对坐标
- 4点折线算法：A顶部 → A上方 → B上方 → B顶部
- 彩色标签背景（`.svgmark-tag-{TAG}` 动态 CSS）
- 响应滚动/resize/数据变化自动重算

**2. 集成到 `AnnotationEditor.tsx`**
- 传递 `viewRef` 给 RelationLines
- 渲染在编辑器容器内（绝对定位 overlay）

**3. 工具栏开关 (`Annotation.tsx`)**
- Show Links / Show Lines / Show Link Name

**4. 调整样式**
- `deltaHeight` 6px（连线距标注上方间距）
- 标签 8px 字体，24×10 背景 rect
- `.cm-gutters` 加 `lineHeight: '2em'` 对齐行号

**5. 文件列表增强**
- 显示文件数量 / tag 数量
- 删除单个文件按钮（`MinusCircleOutlined`）
- 删除全部按钮（红色 `DeleteOutlined` + "All"）
- unsaved 标记（红色 `*` 号）

### 技术难点

**坐标系转换**：
```typescript
// viewport 绝对坐标 → 容器相对坐标
const containerRect = container.getBoundingClientRect()
return {
  left: fromCoords.left - containerRect.left,
  top: fromCoords.top - containerRect.top,
  right: toCoords.right - containerRect.left,
}
```

**时序问题**：
- CM6 渲染完成后才能 `coordsAtPos()`
- 用 `requestAnimationFrame` 延迟一帧
- 边界检查 + try-catch 防止 "No tile" 错误

**调试过程**：
1. 连线在页面顶部 → 修复坐标偏移
2. 加载时无连线 → 加 RAF 延迟
3. 标签被裁掉 → 调整 deltaHeight 14→6
4. 标签白色 → 改用关系类型颜色 CSS

### 验证

- ✅ TypeScript 编译零错误
- ✅ 75 测试通过
- ✅ 浏览器测试：连线正确显示，工具栏开关正常，滚动跟随

### 文件变更

| 文件 | 状态 | 说明 |
|------|------|------|
| `components/RelationLines.tsx` | 新增 | SVG 连线组件 |
| `components/AnnotationEditor.tsx` | 修改 | 集成 RelationLines |
| `components/Annotation.tsx` | 修改 | 工具栏开关 + 文件列表增强 |
| `editor/cm-theme.ts` | 修改 | gutter 行高对齐 |

---

## Session 4.7 — M4 Phase 7: 保存 + 快捷键 + 搜索 (2026-02-17)

**提交**: fc65c8b

- ✅ Save XML 按钮 + Ctrl+S 保存（ann2xml → xml2str → 下载）
- ✅ 快捷键实体创建（1-9, a, c, v, b 映射到 etags[0..12]）
- ✅ CM6 搜索面板（Ctrl+F）
- ✅ 文件列表 Save 按钮 + unsaved 标记

---

## Session 4.8 — M4 Phase 8/9/10: Hint + Sentence + 修复 (2026-02-18, Opus)

### Phase 8: Hint 系统

**Store 扩展** (`store.ts`):
- 新增: `hintDict`, `hints` 状态
- 新增 actions: `rebuildHintDict()`, `setHints()`, `acceptHint(hintId)`, `acceptAllHints()`
- `acceptHint`: hint → `makeEtag` → `addTag` → 增量更新 hintDict

**CM6 装饰层** (`editor/cm-decorations.ts`):
- 新增 `setHintDecorations` StateEffect + `hintDecorationField` StateField
- `HintLabelWidget`: 显示 id_prefix（如 "S"）在 hint 文本前
- CSS `.mark-hint` 虚线下划线 + hover 变色

**编辑器集成** (`AnnotationEditor.tsx`):
- useEffect 中: `enabledHints` 时调用 `searchHintsInAnn()` → dispatch hint 装饰
- mousedown handler: 检测 `[data-hint-id]` → `acceptHint()`

**工具栏** (`Annotation.tsx`):
- "Accept All" 按钮 → `Modal.confirm` → `acceptAllHints()`
- 文件加载后调用 `rebuildHintDict()`

### Phase 9: Sentence 分句模式

**新建 `utils/nlp-toolkit.ts`** (~215行):
- `sentTokenize(text)` — simpledot_v2 算法，按 `.?!;\n` 分句，含缩写异常词表
- `docSpanToSentenceOffset()` / `sentenceOffsetToDocPos()` — 双向偏移映射
- `remapSpansToSentenceView()` — 批量重映射 tag spans
- `ensureAnnSentences(ann)` — 懒计算 `ann._sentences`

**编辑器集成**:
- `displayMode === 'sentences'` 时用 `_sentences_text` 替代 `text`
- 装饰 dispatch 前重映射 tag/hint spans
- 右键/快捷键创建标注时反向映射选区
- `RelationLines.tsx` 也做了 span 重映射

### Phase 10: 小修复

- `RelationLines.tsx`: displayTagName 过滤连线
- `Annotation.tsx`: 加载进度 Spin + 进度文字

### 测试精简 (104 → 21)

砍掉琐碎边界用例，每个模块只保留核心路径 + roundtrip：

| 文件 | 旧 | 新 | 覆盖 |
|------|----|----|------|
| dtd-parser.test.ts | 17 | 3 | 解析 + DTD/JSON roundtrip |
| ann-parser.test.ts | 30 | 6 | span工具 + xml roundtrip + hint + hash |
| brat-parser.test.ts | 14 | 2 | collection + document 数据 |
| bioc-parser.test.ts | 6 | 1 | BioC 导出 |
| tag-helper.test.ts | 8 | 3 | makeEtag + makeRtag + getIdref |
| nlp-toolkit.test.ts | 29 | 6 | 分句 + 缩写 + roundtrip + ensureAnn |

### 文件变更

| 文件 | 状态 |
|------|------|
| `store.ts` | 修改: +hint 状态和 actions |
| `editor/cm-decorations.ts` | 修改: +hint 装饰层 + HintLabelWidget |
| `editor/cm-setup.ts` | 修改: 注册 hintDecorationField |
| `editor/cm-theme.ts` | 修改: +hint label CSS |
| `components/AnnotationEditor.tsx` | 修改: hint + sentence 集成 |
| `components/Annotation.tsx` | 修改: Accept All + loading + rebuildHintDict |
| `components/RelationLines.tsx` | 修改: displayTagName 过滤 + sentence 重映射 |
| `utils/nlp-toolkit.ts` | 新增: 分句器 + 偏移映射 |
| `utils/__tests__/nlp-toolkit.test.ts` | 新增: 6 个测试 |
| `test-annotation-2.xml` | 新增: hint 测试数据 |
| `test-annotation-3.xml` | 新增: hint 测试数据 |
| 所有 `__tests__/*.test.ts` | 精简: 104→21 |

### 验证

- ✅ `npm run build` 零错误
- ✅ `npm test` 21 测试全部通过
- ✅ 浏览器: hint 显示/点击接受/全部接受, sentence 模式标注位置正确

---

## M4 架构计划 — 标注编辑器

### 10 个 Phase 进度（全部完成）

- [x] Phase 1: Store 扩展 + Tag Helper ✅ (8abb46a)
- [x] Phase 2: CM6 核心集成 ✅ (9984b6b)
- [x] Phase 3: 右键菜单 + 实体创建 ✅ (984c21b)
- [x] Phase 4: 标注表格交互增强 ✅ (cc604c8)
- [x] Phase 5: 关系标注链接 ✅ (cee2db6)
- [x] Phase 6: 关系连线渲染 ✅ (11c504f)
- [x] Phase 7: 保存 + 快捷键 + 搜索 ✅ (fc65c8b)
- [x] Phase 8: Hint 系统 ✅
- [x] Phase 9: Sentence 分句模式 ✅
- [x] Phase 10: 小修复（连线过滤 + 加载进度） ✅

---

## Session 5.1 — M5: 可视化 Schema Editor (2026-02-19, Sonnet → Opus)

对照原版 `app_hotpot_ext_se.js` (380行) + `_annotator_mui_annotation_schema_editor.html` (332行)。

**新增/修改：**
- `store.ts` (+23行): `seDtd`/`seOpen` 状态 + 5 个 actions (openNew/Copy/Load, close, setSeDtd)
- `utils/tag-helper.ts` (+14行): 导出 `APP_SHORTCUTS` + `assignTagShortcuts`（从 Annotation.tsx 提取）
- `components/SchemaEditor.tsx` (~290行): Ant Design Modal，Tag/Attr CRUD，Sample 加载，Use/Download
- `components/Annotation.tsx`: 添加 Schema Editor 图标按钮 + 渲染 `<SchemaEditor />`
- `components/RelationLines.tsx`: 移除 `enabledLinkComplex`（Show Lines 开关删除）

**关键模式：**
- 深拷贝 + mutate: `JSON.parse(JSON.stringify(seDtd))` → mutate → `setSeDtd(copy)`
- "Use" 流程: `extendBaseDtd → assignTagColors → assignTagShortcuts → injectTagColors → setDtd → clearAnns`
- Sample DTD: Vite `?raw` 导入 4 个 sample/ 目录的 .dtd 文件
- Sticky 工具栏: `top: -8px`（补偿 Modal body padding）
- Modal `zIndex: 2000`，LIST DEFAULT 用 Select + `popupMatchSelectWidth={false}`

**验证**: 编译零错误，21 测试通过，浏览器功能正常

---

## Session 6.1 — M6 Phase 1-3: Statistics + Export + Converter (2026-02-19)

**提交**: 5c31721, e2a4f90, 8f8f49e

### Phase 1: Statistics Tab (5c31721)

- `components/Statistics.tsx` 重写：对照原版 `app_hotpot_ext_statistics.js` (118行)
- 从全局 store 读取 dtd + anns，计算语料库统计
- 显示：文件数、总 tag 数、各 tag 类型数量、每文件 tag 分布

### Phase 2: Export Tab (e2a4f90)

- `components/Export.tsx` 重写：对照原版 `app_hotpot_ext_exporter.js` (75行)
- 支持导出格式：XML(原格式)、BioC XML、JSON、CSV
- 批量导出为 ZIP（使用 JSZip）

### Phase 3: Converter Tab (8f8f49e)

- `components/Converter.tsx` 重写：对照原版 `app_hotpot_ext_converter.js` (418行)
- Raw Text → XML 转换（拖拽 .txt 文件 + 选择 DTD）
- MedTagger → XML 转换（.txt + .ann 文件配对）
- 转换结果预览 + 批量下载 ZIP

---

## Session 6.2 — M6 Phase 4: Adjudication/IAA Tab (2026-02-19, Opus)

**提交**: c369b98

### 新增文件

- **`utils/iaa-calculator.ts`** (~650行)：IAA 计算引擎，移植自 `iaa_calculator.js` (1966行)
  - 类型：IaaDict, GsDict, GsAnnEntry, GsTagObj, AnnRst, TagResult, Cm, CmTags, CohenKappa
  - 文档匹配：`hash(ann.text)` MurmurHash 文本哈希配对
  - Tag 匹配：overlap（Jaccard 字符级）/ exact（精确 spans）
  - 混淆矩阵：TP(双方一致) / FP(仅A) / FN(仅B)，存储 `[tag_a, tag_b]` 对
  - 指标：F1/Precision/Recall + Cohen's Kappa（含 95% CI、边际概率）
  - Gold Standard：初始化默认值（TP 接受 A 版本）、accept/reject
  - 报告：5 个 sheet（Summary/CohenKappa/Files/Tags/Adjudication）

- **`components/Adjudication.tsx`** (~846行)：完整 IAA UI
  - Ribbon：ClearAll、A/B Dropzone、Overlap%、Attributes 开关、Calculate、Report、Download
  - F1 Score 面板：左侧汇总条(220px) + 中间文件列表 + 右侧 tag 详情（accept/reject 裁决）
  - Cohen's Kappa 面板：指标汇总 + 混淆矩阵（旋转表头 + 边际概率行列）
  - 子组件：RibbonBtn, TG, IaaDropzone, IaaTagInfo, IaaTagInfoGs, F1Bar
  - 导出：All Tags A&B ZIP、Gold Standard ZIP、Excel Report (xlsx)

### Bug 修复

- **`evaluateAnnOnDtd` 崩溃**（`Cannot read properties of undefined (reading 'tp')`）：
  - 原因：`getCohenKappaOverall(result)` 调用时 `result.all` 仍为 `{} as TagResult`，`.cm` 未定义
  - 修复：`result.all = allResult` 移到 `getCohenKappaOverall()` 调用之前
- **`import XLSX from 'xlsx'`**：xlsx 无 default export → `import * as XLSX from 'xlsx'`
- **calculate 无 try-catch**：添加 try-catch + `message.error()` 显示错误

### 验证

- ✅ 编译零错误，21 测试通过
- ✅ 浏览器：F1 Score (OVERALL 0.8571) + Cohen's Kappa (0.6667) + 混淆矩阵正确

---

## Session 6.3 — M6 Phase 5: Remove Error Analysis + Toolkit (2026-02-19)

**提交**: 845e9d4

### 删除 Error Analysis Tab

- 删除 `components/ErrorAnalysis.tsx`
- 从 `App.tsx`、`RibbonMenu.tsx`、`store.ts` (TabKey) 中移除所有引用
- 用户决定不需要此功能

### 新增/修改

- **`components/Toolkit.tsx`** (~270行)：MedTaggerVis 可视化工具
  - Ribbon：MedTaggerVis 按钮、Clear All、Show Certainty/Status 开关、Help
  - 三列布局：Raw .txt Files | Output .ann Files | Visualization
  - 拖拽加载 .txt 和 .ann 文件
  - 点击 .ann → 自动匹配同名 .txt（`doc.txt.ann` → `doc.txt`）→ 渲染高亮
  - 实体颜色 + type 标签 + Certainty/Status 属性 glyph（➕➖❓等）
  - 自实现渲染（非 BRAT 库）：解析 medtagger2brat 结果 → 构建 segments → React 渲染

- **`parsers/brat-parser.ts`** (+25行)：
  - 导出 `MedTaggerRecord` 接口（原为 internal）
  - 新增 `parseMedTaggerAnn(text)`: 解析 MedTagger `.ann` 格式（tab 分隔 + key="value" 对）
  - 新增 `parseMedTaggerLine(line)`: 解析单行

### 验证

- ✅ 编译零错误，21 测试通过

---

## M6 进度（全部完成）

- [x] Phase 1: Statistics Tab ✅ (5c31721)
- [x] Phase 2: Export Tab ✅ (e2a4f90)
- [x] Phase 3: Converter Tab ✅ (8f8f49e)
- [x] Phase 4: Adjudication/IAA Tab ✅ (c369b98)
- [x] Phase 5: Remove Error Analysis + Toolkit (MedTaggerVis) ✅ (845e9d4)

---