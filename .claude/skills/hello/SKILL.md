---
name: hello
description: 打招呼并简要介绍 MedGenie 项目状态, git状态
argument-hint: "your-name"
---

用中文跟用户打招呼（称呼 $ARGUMENTS），根据当前时间说早上好/下午好/晚上好，然后并行执行以下检查：

## 检查项（并行执行，某项失败不影响其他）

1. **Git 状态**
   - `git branch --show-current` 当前分支
   - `git log --oneline -5` 最近 5 条提交
   - `git diff --stat HEAD` 未提交改动（没有就说"工作区干净"）
   - `git rev-list --left-right --count main...HEAD` 与 main 的差距

2. **构建检查**
   - `npm run build` 是否零错误（只显示最后几行，在项目根目录执行）

3. **测试状态**
   - `npm test -- --run` 通过/失败数量（在项目根目录执行）

4. **代码待办扫描**
   - 用 Grep 工具搜索 `TODO|FIXME|HACK|XXX`（限 src/ 目录）
   - 报告数量和所在文件，超过 5 条只列前 5 条

## 输出格式

先输出一个汇总表格：

| 项目 | 状态 |
|------|------|
| 分支 | xxx |
| 未提交改动 | 有 x 文件 / 工作区干净 |
| 与 main 差距 | ahead x, behind x |
| 构建 | ✅ 通过 / ❌ 失败 |
| 测试 | ✅ xx passed / ❌ xx failed |
| 代码待办 | x 条 TODO/FIXME |

然后用 2-3 句话总结当前进展和建议的下一步（参考 CLAUDE.md 中的项目状态表）。
