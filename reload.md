# MedTator React 重构项目

## 项目信息

- **原项目**: [OHNLP/MedTator](https://github.com/OHNLP/MedTator) v1.3.16
- **新仓库**: [jay2zxy/MedTator_React](https://github.com/jay2zxy/MedTator_React.git)
- **开发分支**: `jay-dev`
- **开始日期**: 2026-02-11

---

## 为什么重构？

**当前问题**: jQuery + Vue 2.6 混合架构，700KB 代码无模块化，全局变量，难以维护

**重构目标**: React 18 + TypeScript + Vite，现代化架构，类型安全，高性能

**技术栈**:
- React 18 + TypeScript + Vite
- Zustand (状态) + Ant Design (UI)
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
└── MedTator-React/          # React 版本（待开发）
    └── (空)
```


---

### 📋 待开发模块

#### 【基础】M1-项目搭建 (3天)
- [ ] Vite + React + TypeScript 初始化
- [ ] Ant Design 集成
- [ ] ESLint + Prettier 配置
- [ ] 基础布局 (Ribbon Menu/Content 双栏结构)
- [ ] React Router 配置

#### 【基础】M2-数据类型 (2天)
- [ ] Entity/Relation/Annotation 类型定义
- [ ] Schema/DTD 数据结构
- [ ] 与原版数据格式对齐 (参照 app_hotpot.js vpp_data)

#### 【基础】M3-解析器集合 (5天) ⬆ 提前：纯函数，可独立测试
- [ ] ann_parser.js → TypeScript (1085行, 最核心)
- [ ] dtd_parser.js → TypeScript (1092行)
- [ ] brat_parser.js → TypeScript (560行)
- [ ] bioc_parser.js → TypeScript (229行)
- [ ] 用 sample/ 数据集做兼容性测试 (golden test)

#### 【基础】M4-状态管理 (2天)
- [ ] Zustand stores (annotation/schema/file/ui)
- [ ] 持久化中间件
- [ ] 状态同步逻辑

#### 【核心】M5-文件系统 (3天)
- [ ] File System Access API 封装 (参照 fs_helper.js 417行)
- [ ] 文件导入/导出逻辑
- [ ] ZIP 文件处理 (JSZip)

#### 【核心】M6-brat 封装 (3天)
- [ ] BratVisualizer React 组件
- [ ] brat 初始化逻辑
- [ ] 事件桥接 (React ↔ brat)
- [ ] 数据同步

#### 【核心】M7-标注编辑器 (15天) ⭐ 最重要，最复杂
- [ ] 文本显示组件
- [ ] 文本选择逻辑
- [ ] 实体标注 UI (上下文菜单、标签选择)
- [ ] 关系标注 UI (连线、属性编辑)
- [ ] 快捷键系统
- [ ] 撤销/重做
- [ ] 对应原版: app_hotpot.js (3795行) + 多个 ext 模块 + 模板

#### 【功能】M8-Schema 编辑器 (4天)
- [ ] DTD 编辑器 (对应 ext_codemirror 1048行 + ext_se 379行)
- [ ] 可视化配置界面
- [ ] Schema 验证

#### 【功能】M9-语料库管理 (3天)
- [ ] 文件列表组件 (对应 ext_texts 118行)
- [ ] 批量操作
- [ ] 分页显示

#### 【功能】M10-IAA 计算器 (4天)
- [ ] Cohen's Kappa 算法 (对应 iaa_calculator 1965行)
- [ ] F1 Score 计算
- [ ] 多标注者对比界面 (对应 ext_iaa 738行)

#### 【功能】M11-Razer 裁决工具 (5天)
- [ ] 差异可视化 (对应 error_analyzer 682行)
- [ ] 裁决流程 (对应 ext_razer 1314行)
- [ ] 批量裁决

#### 【功能】M12-统计分析 (3天)
- [ ] 语料库统计 (对应 stat_helper 402行 + ext_statistics 118行)
- [ ] ECharts 图表集成
- [ ] 报表生成

#### 【功能】M13-工具集 (3天)
- [ ] IOB2 编辑器 (对应 iob_helper 44行)
- [ ] 格式转换器 (对应 ext_converter 418行)
- [ ] MedTagger 可视化 (对应 medtagger_toolkit 234行)

#### 【优化】M14-性能优化 (3天)
- [ ] 代码分割和懒加载
- [ ] 虚拟化列表 (react-window)
- [ ] Bundle 分析优化

#### 【优化】M15-测试部署 (3天)
- [ ] 单元测试 (Vitest)
- [ ] E2E 测试 (Playwright)
- [ ] GitHub Pages 部署

---

## 📊 开发时间线

**Week 1-2**: M1→M2 (项目搭建 + 类型定义)
**Week 3-4**: M3 (解析器迁移 + golden test 验证)
**Week 5**: M4→M5 (状态管理 + 文件系统)
**Week 6-7**: M6 (brat 封装)
**Week 8-11**: M7 (标注编辑器，核心主战场)
**Week 12-14**: M8→M9→M10 (功能模块 1-3)
**Week 15-16**: M11→M12→M13 (功能模块 4-6)
**Week 17-18**: M14→M15 (优化上线)

**总计**: 18 周 / 15 个模块

---

## 🎯 当前状态

**正在做**: 熟悉原版代码，确保原版可正常运行
**下一步**: 开始 M1-项目搭建 (在 MedTator-React/ 下初始化)
**进度**: 0/15 模块 (0%)

---

## 📝 开发日志

### 2026-02-11 - 项目启动
- ✅ Fork 原项目到个人仓库
- ✅ 创建 jay-dev 开发分支
- ✅ 搭建 Python 虚拟环境
- ✅ 原版应用成功运行
- ✅ 创建工作文档 work.md
- 📊 代码分析：35个JS文件 (18807行) + 23个HTML模板 (11031行)
- 📊 核心文件：app_hotpot.js (3795行) + 13个扩展模块 (~6500行)
- 📊 解析器：ann(1085行) + dtd(1092行) + brat(560行) + bioc(229行)
- 🎯 确定重构策略：brat 封装而非重写，原版代码保持不动
- 🔧 修正重构计划：解析器提前到 M3，标注编辑器调整为 15天，总周期 18周

### 待更新...

---

## 🔗 参考

- **原项目**: https://github.com/OHNLP/MedTator
- **新仓库**: https://github.com/jay2zxy/MedTator_React
- **原项目 Wiki**: https://github.com/OHNLP/MedTator/wiki

---

## 💡 快速命令

```bash
# 原版运行
source venv/Scripts/activate && python web.py
# 访问: http://localhost:8086

# React 版运行（待创建）
cd MedTator-React && npm run dev
# 访问: http://localhost:5173
```

---

*最后更新: 2026-02-11*
