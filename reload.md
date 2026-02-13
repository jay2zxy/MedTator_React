# MedTator React 重构项目

## 项目信息

- **原项目**: [OHNLP/MedTator](https://github.com/OHNLP/MedTator) v1.3.16
- **新仓库**: [jay2zxy/MedTator_React](https://github.com/jay2zxy/MedTator_React.git)
- **开发分支**: `jay-dev`
- **开始日期**: 2026-02-11

---

## 为什么重构？

**当前问题**: jQuery + Vue 2.6 混合架构，700KB 代码无模块化，全局变量，难以维护

**重构目标**: 功能完全一致，打包成桌面App可随时使用

**技术栈**:
- React 18 + TypeScript + Vite
- Zustand (状态) + Ant Design (UI)
- Electron (桌面打包，替代浏览器File System Access API)
- brat 封装 + ECharts + JSZip

---

## 🎯 模块任务清单

### ✅ 已完成

**2026-02-11**:
- [x] 仓库迁移 + 创建 jay-dev 分支
- [x] 原版环境搭建 (Python venv + Flask)
- [x] 原版应用运行成功 (http://localhost:8086)

---

### 🚧 进行中 - 项目重构

**实际目录结构**（原版代码保持不动，React 版在 MedTator-React/ 下开发）：

```
MedTator/  (Git 仓库根目录)
│
├── .git/                    # Git 仓库
├── .gitignore
├── work.md                  # 工作文档
├── README.md
├── LICENSE
│
├── web.py                   # Flask 开发服务器 (349行)
├── config.py                # 配置文件 (221行)
├── requirements.txt         # Python 依赖
├── venv/                    # Python 虚拟环境
│
├── templates/               # 原版前端代码 ⭐
│   ├── index.html           # 主入口 (637行)
│   ├── css/                 # 样式 (main.css 36K, box.css 2.4K)
│   ├── js/                  # JS 模块 (35文件, 18807行)
│   │   ├── app_hotpot.js    #   核心 Vue 实例 (3795行)
│   │   ├── app_hotpot_ext_*.js  # 13个扩展模块 (~6500行)
│   │   ├── ann_parser.js    #   XML 解析器 (1085行)
│   │   ├── dtd_parser.js    #   Schema 解析器 (1092行)
│   │   ├── brat_parser.js   #   BRAT 格式 (560行)
│   │   ├── bioc_parser.js   #   BioC 格式 (229行)
│   │   └── ...              #   工具类 (iaa_calculator, nlp_toolkit 等)
│   └── _annotator_*.html    # 23个组件模板 (~11000行)
│
├── docs/                    # 静态构建输出 + 第三方库 (24M)
│   └── static/lib/          # 26个第三方库 (20M)
│
├── sample/                  # 示例数据 (8个数据集, 135文件, 564K)
├── scripts/                 # Python 工具脚本 (12个)
│
└── MedTator-React/          # React 版本（开发中）
    ├── node_modules/        # 176个依赖包
    ├── public/              # 公共静态资源
    ├── src/                 # 源代码（待开发）
    ├── package.json         # 依赖配置
    ├── vite.config.ts       # Vite配置
    ├── tsconfig.json        # TypeScript配置
    └── index.html           # 入口HTML
```


---

## 🏗️ 架构设计（简化版）

### 设计原则

- **功能一致** - 和原版一模一样，能用就行
- **结构简单** - 扁平目录，不搞过度嵌套
- **打包成App** - 最终用 Electron 打包成桌面应用

### 原版架构深度分析

**Flask 服务器 (web.py) — 几乎啥都没干：**
- 只有一个路由 `/`，渲染 index.html 并注入 sample 数据
- 没有任何后端 API，100% 纯前端应用
- Flask 本质就是个静态文件服务器，可以被任何 HTTP server 替代

**Vue 实例 (app_hotpot.js) — 一个巨型对象：**
- `new Vue({ el: '#app_hotpot', data: vpp_data, methods: vpp_methods })`
- `vpp_data` 全局状态含 30+ 属性（section, dtd, anns, ann_idx, cm, cfg, texts, hints, is_linking...）
- Tab 切换：`switch_mui(section)` 改变 `this.section`，HTML 用 `v-show` 显示/隐藏

**文件操作 (fs_helper.js) — 浏览器 File System Access API：**
- `showOpenFilePicker()` → 用户选文件 → `getFile().text()` 读内容
- `showSaveFilePicker()` → `createWritable()` 写文件
- 每次都需要用户手动选择，无法直接访问文件系统
- → Electron 替代后可直接用 Node.js fs，体验更好

**7个Tab对应的扩展模块：**

| Tab | 扩展模块 | 行数 | 核心功能 |
|-----|---------|------|---------|
| Annotation | ext_codemirror.js | 1,048 | CodeMirror编辑器+标注 |
| Statistics | ext_statistics.js | 118 | 语料库统计 |
| Export | ext_exporter.js | 75 | 导出格式 |
| Adjudication | ext_iaa.js | 738 | 标注者间一致性 |
| Converter | ext_converter.js | 418 | 格式转换 |
| Error Analysis | ext_razer.js | 1,314 | NLP错误分析 |
| Toolkit | ext_toolkit.js | 282 | NLP工具集 |

**4个解析器 — 纯函数，无DOM依赖：**
- dtd_parser.js (1092行) — Schema定义解析（DTD/JSON/YAML）
- ann_parser.js (1085行) — 标注XML/TXT解析
- brat_parser.js (560行) — BRAT格式转换
- bioc_parser.js (229行) — BioC XML格式转换

**第三方库依赖 (docs/static/lib/)：**
- CodeMirror, BRAT可视化, D3, ECharts, JSZip, FileSaver, PapaParse, Compromise(NLP)

**数据流：**
```
用户选文件 → fs_helper → parser解析 → vpp_data(全局状态) → Vue渲染UI
用户编辑标注 → vpp_data更新 → Vue重渲染 → 保存时fs_helper写回文件
```

### React目录结构

```
MedTator-React/src/
├── App.tsx                  # 主组件，Tab切换
├── main.tsx                 # 入口
├── store.ts                 # Zustand，一个文件搞定全局状态
├── types.ts                 # 类型定义，一个文件够用
│
├── components/              # 所有组件扁平放
│   ├── RibbonMenu.tsx       # 顶部菜单（对应Metro UI Ribbon）
│   ├── FileList.tsx         # 文件列表
│   ├── Editor.tsx           # CodeMirror封装
│   ├── BratViewer.tsx       # BRAT可视化封装
│   ├── SchemaEditor.tsx     # Schema编辑器
│   ├── Statistics.tsx       # 统计面板
│   ├── Export.tsx           # 导出
│   ├── Adjudication.tsx     # IAA裁决
│   ├── Converter.tsx        # 格式转换
│   ├── ErrorAnalysis.tsx    # 错误分析
│   └── Toolkit.tsx          # 工具集
│
├── parsers/                 # 解析器（从原版直接移植）
│   ├── ann-parser.ts
│   ├── dtd-parser.ts
│   ├── brat-parser.ts
│   ├── bioc-parser.ts
│   └── __tests__/           # Vitest 单元测试
│       ├── dtd-parser.test.ts
│       ├── ann-parser.test.ts
│       ├── brat-parser.test.ts
│       └── bioc-parser.test.ts
│
└── utils/                   # 工具函数
    ├── file-helper.ts       # 文件操作（Electron fs）
    └── iaa-calculator.ts    # IAA算法
```

### 技术映射

| 原版 | React版 |
|------|---------|
| Metro UI Ribbon | Ant Design Menu |
| Vue 2.6 v-show切Tab | React state + 条件渲染 |
| app_hotpot.vpp_data | Zustand store（一个文件） |
| CodeMirror 5 | @uiw/react-codemirror |
| BRAT可视化 | useEffect封装原JS |
| File System Access API | Electron Node.js fs |
| JSZip + FileSaver | 保持不变 |
| jQuery DOM操作 | React状态驱动 |

### 砍掉的东西

- ~~React Router~~ → 不需要，state切Tab就行
- ~~ESLint + Prettier~~ → 不搞规范
- ~~E2E测试~~ → 不写端到端测试
- 单元测试：Vitest + jsdom（仅覆盖解析器等核心逻辑）
- ~~性能优化（虚拟列表、代码分割）~~ → 先能用再说
- ~~多slice状态管理~~ → 一个store.ts搞定
- ~~深层目录嵌套~~ → 扁平结构

---

### 📋 模块任务（简化为8个）

#### M1-项目搭建 (2天) - 基本完成
- [x] Vite + React + TypeScript 初始化 (✅ 2026-02-11)
- [x] 安装 Ant Design + Zustand (✅ 2026-02-11)
- [x] RibbonMenu + Tab切换布局 (✅ 2026-02-11)
- [ ] Electron 基础集成（推迟到M7，先做功能）

#### M2-解析器移植 (4天) - ✅ 已完成
- [x] dtd_parser → TypeScript (1092行)
- [x] ann_parser → TypeScript (1085行)
- [x] brat_parser → TypeScript (560行)
- [x] bioc_parser → TypeScript (229行)
- [x] 代码审查（逐函数对照原版，修复9个问题）
- [x] 单元测试：Vitest + jsdom，67个测试全部通过
- [x] 用sample/数据验证（DTD解析、roundtrip、BRAT数据生成）

#### M3-状态管理 + 文件操作 (3天) - 🚧 进行中 (83%)
- [x] store.ts 完善（对应vpp_data 30+属性）✅ Step 1 完成 (2026-02-12)
- [x] 浏览器文件操作（input+drag&drop，Schema/Annotation加载+UI更新）✅ Step 2 完成 (2026-02-12)
- [ ] ZIP打包（JSZip）- 可选

#### M4-标注编辑器 (12天) ⭐ 核心
- [ ] 文件列表 + CodeMirror编辑器
- [ ] 实体标注（选中文本 → 创建标签）
- [ ] 关系标注（连线 + 属性）
- [ ] BRAT可视化封装
- [ ] 快捷键
- [ ] 对应原版: app_hotpot.js (3795行) + ext模块

#### M5-Schema编辑器 (3天)
- [ ] DTD编辑器 (CodeMirror)
- [ ] Schema验证

#### M6-其他功能Tab (6天)
- [ ] Statistics (统计 + ECharts)
- [ ] Export (导出)
- [ ] Adjudication (IAA + 裁决)
- [ ] Converter (格式转换)
- [ ] Error Analysis
- [ ] Toolkit

#### M7-Electron打包 (2天)
- [ ] 主进程 + 预加载脚本
- [ ] 文件系统权限
- [ ] 打包成 .exe / .dmg

#### M8-联调修bug (3天)
- [ ] 功能对齐检查
- [ ] 修bug

---

## 📊 开发时间线

**Week 1**: M1 项目搭建 + M2 解析器移植
**Week 2-3**: M3 状态+文件 + M4 标注编辑器（开始）
**Week 4-5**: M4 标注编辑器（完成）
**Week 6-7**: M5 Schema + M6 其他功能Tab
**Week 8**: M7 Electron打包 + M8 联调修bug

**总计**: 8 周 / 8 个模块（比之前砍了一半）

---


