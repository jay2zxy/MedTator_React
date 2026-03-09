---
name: sync
description: 双仓库状态检查与同步（外层 dev + 内层 release）
argument-hint: "[inner|outer|both]"
---

用中文输出。检查 MedGenie 双仓库的 git 状态。

默认检查两个仓库（both）。如果 $ARGUMENTS 为 "inner" 只检查内层，"outer" 只检查外层。

## 仓库信息

| | 外层（开发仓库） | 内层（成品仓库） |
|---|---|---|
| 本地路径 | 项目根目录 `MedGenie/` | `MedGenie/MedGenie-React/` |
| 远程 | jay2zxy/MedTator_React.git | PittNAIL/MedGenie.git |
| 默认分支 | main | master |
| 开发分支 | jay-dev | jay-dev-release |

## 检查项（对每个仓库并行执行）

1. `git branch --show-current` — 当前分支
2. `git remote -v` — 远程地址（确认指向正确）
3. `git status --short` — 未提交改动（没有就说"工作区干净"）
4. `git log --oneline -3` — 最近 3 条提交
5. `git rev-list --left-right --count <default-branch>...<current-branch>` — 与默认分支的差距
6. `git fetch --dry-run 2>&1` — 远程是否有新提交（注意：不实际拉取）

**注意**：外层仓库的命令在项目根目录执行，内层仓库的命令在 `MedGenie-React/` 目录执行。使用 `git -C <path>` 指定目录，避免 cd。

## 输出格式

对每个仓库输出一个表格：

### 外层仓库（jay2zxy/MedTator_React）

| 项目 | 状态 |
|------|------|
| 分支 | xxx |
| 远程 | ✅ 正确 / ⚠️ 不匹配 |
| 未提交改动 | x 文件 / 工作区干净 |
| 最近提交 | abc1234 message... |
| 与 main 差距 | ahead x, behind x |
| 远程同步 | ✅ 已同步 / ⚠️ 远程有新提交 |

### 内层仓库（PittNAIL/MedGenie）

（同上格式）

## 最后建议

根据检查结果，给出操作建议：
- 如果有未提交改动 → 提醒先 commit 或 stash
- 如果 behind 远程 → 建议 `git pull --rebase`
- 如果两个仓库状态不一致 → 提醒同步
- 如果一切正常 → 说"两个仓库状态健康"
