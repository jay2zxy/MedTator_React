# MedTator 重构项目 - Claude会话记录

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
