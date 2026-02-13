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

---

*最后更新: 2026-02-12*