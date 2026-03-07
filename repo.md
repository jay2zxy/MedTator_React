# 仓库架构

## 本地目录结构

```
MedGenie/                          ← 外层（开发仓库）
├── .git/                          ← 指向 jay2zxy/MedTator_React.git
├── MedGenie-React/                ← 内层（成品仓库）
│   ├── .git/                      ← 指向 PittNAIL/MedGenie.git
│   ├── src/...                    ← React 源码
│   ├── dist/                      ← Vite 构建输出（git ignored）
│   ├── electron/                  ← Electron 主进程 + 预加载脚本
│   │   ├── main.cjs               ← 创建窗口、加载页面
│   │   └── preload.cjs            ← contextBridge 暴露 API
│   └── release/                   ← electron-builder 输出（git ignored）
│       ├── win-unpacked/          ← 免安装版（Chromium + app.asar）
│       └── MedGenie Setup x.x.x.exe  ← NSIS 安装包
├── docs/
├── sample/
├── scripts/
└── ...
```

## 两个仓库

| | 开发仓库（外层） | 成品仓库（内层） |
|---|---|---|
| 远程地址 | https://github.com/jay2zxy/MedTator_React.git | https://github.com/PittNAIL/MedGenie.git |
| 本地路径 | `MedGenie/` | `MedGenie/MedGenie-React/` |
| 默认分支 | main | master |
| 开发分支 | jay-dev | jay-dev-release |
| 用途 | 重构过程记录、文档、旧代码 | 重构完成的 React 项目 |

## 关系

- 外层 git 把 `MedGenie-React/` 当**普通文件夹**跟踪（非 submodule），开发记录完整保留
- 内层 git 独立管理，推送到 PittNAIL 组织仓库
- 两个仓库互不干扰，本地正常开发调试

## 操作记录（2026-03-04）

### 1. 外层仓库清理

```bash
# 取消跟踪本地开发文档（文件保留在磁盘）
git rm --cached CLAUDE.md learn.md log.detail.md log.md quantum_test/quantum.md reload.md

# 加入 .gitignore 防止重新跟踪
# → CLAUDE.md, log.md, log.detail.md, learn.md, reload.md, quantum_test/quantum.md

# 删除废弃分支和远程
git branch -D release-m6
git remote remove pittmail
```

### 2. 内层仓库创建

```bash
cd MedGenie-React

# 初始化并推送到 PittNAIL/MedGenie
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/PittNAIL/MedGenie.git

# 推送到 master（force push 覆盖远程已有的无关历史）
git push origin jay-dev-release:master --force

# 创建开发分支
git checkout -b jay-dev-release
git push -u origin jay-dev-release
```

### 3. 工作流

- **日常开发**：在 `MedGenie-React/` 下开发，`npm run dev` 本地调试
- **推送成品**：在 `MedGenie-React/` 下 `git push`，推到 PittNAIL/MedGenie
- **推送开发记录**：在 `MedGenie/` 下 `git push`，推到 jay2zxy/MedTator_React
- **发布流程**：`jay-dev-release` → PR merge 到 `master`

## Electron 打包（M8）

### 架构

```
用户双击 MedGenie.exe
  → Chromium 引擎启动（dll 们 + locales）
  → Node.js 主进程读取 app.asar
  → 执行 electron/main.cjs → 创建 BrowserWindow
  → 加载 preload.cjs → 注入 electronAPI
  → 加载 dist/index.html → React 应用运行
```

### 构建产物

| 文件 | 说明 |
|------|------|
| `release/win-unpacked/MedGenie.exe` | ~214MB，内嵌 Chromium + Node.js |
| `release/win-unpacked/resources/app.asar` | ~1.5MB，你的代码（dist/ + electron/） |
| `release/win-unpacked/locales/` | ~45MB，Chromium 多语言包 |
| `release/MedGenie Setup 1.0.0.exe` | ~93MB，NSIS 安装包（压缩后） |

### 开发命令

```bash
npm run electron:dev    # Vite + Electron 同时启动（开发模式）
npm run electron:build  # tsc + vite build + electron-builder --win
```

### 已知问题

- **Windows 符号链接权限**：首次打包需开启「开发人员模式」（设置 → 更新和安全 → 开发者选项），否则 winCodeSign 解压报错。或用管理员终端运行。
- **打包体积**：所有依赖必须在 `devDependencies`（Vite 已打包进 dist），否则 electron-builder 会把 node_modules 塞进 asar。

## 注意事项

- git 命令在哪个目录执行，就操作哪个仓库（就近找 `.git`）
- 两个仓库的 remote 都叫 `origin`，但指向不同地址
- `.gitignore` 只阻止 git 跟踪，不影响本地文件使用
