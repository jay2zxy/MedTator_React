---
name: check
description: Phase 完成验收：build + test + 功能对比清单
argument-hint: "[module-name]"
---

用中文输出。执行 CLAUDE.md 规定的 Phase 完成前三步验收。如果 $ARGUMENTS 不为空，则在输出中标注当前验收的模块名。

## 步骤（并行执行，某项失败不影响其他）

### 1. 构建检查
- 在 `MedGenie-React/` 目录下运行 `npm run build`
- 只关注是否零错误（显示最后几行）

### 2. 测试检查
- 在 `MedGenie-React/` 目录下运行 `npm test -- --run`
- 报告通过/失败数量

### 3. 代码质量扫描
- 用 Grep 搜索 `TODO|FIXME|HACK|XXX`（限 `MedGenie-React/src/`）
- 报告数量，超过 5 条只列前 5 条

### 4. 功能对比清单生成
根据 CLAUDE.md 中的组件列表，生成需要人工逐一对比的功能检查表：

**原版**：Flask 应用 localhost:8086
**React 版**：localhost:5173

按模块输出 checklist（markdown checkbox 格式），覆盖以下维度：
- UI 控件是否存在且布局一致
- Store 数据是否正确接入
- 渲染效果是否一致（颜色、字体、间距）
- 交互行为是否一致（点击、拖拽、快捷键）

模块列表：
1. Schema 加载（拖拽/文件选择/Schema Editor）
2. Annotation 加载（拖拽/批量/进度）
3. 文件列表（排序/过滤/分页/删除）
4. 标注编辑器（高亮/hint/sentence/搜索）
5. 右键菜单 + 实体创建（快捷键）
6. 左键菜单 + 关系链接（状态机）
7. 标注表格（属性编辑/删除/级联）
8. 关系连线（SVG/开关/过滤）
9. 保存（Ctrl+S / Save 按钮）
10. Statistics Tab
11. Export Tab（XML/BioC/JSON/CSV/ZIP）
12. Converter Tab（Raw Text/MedTagger）
13. IAA/Adjudication Tab（F1/Kappa/裁决/Excel）
14. Toolkit Tab（MedTaggerVis）
15. LLM 自动标注（Ollama 连接/标注/中止）

如果 $ARGUMENTS 指定了模块名（如 "annotation" "export"），只输出该模块的详细 checklist，否则输出全部模块的精简版（每模块 2-3 项关键检查点）。

## 输出格式

先输出汇总：

| 项目 | 状态 |
|------|------|
| 构建 | ✅ 通过 / ❌ 失败（附错误摘要） |
| 测试 | ✅ xx passed / ❌ xx failed |
| 代码待办 | x 条 |

然后输出功能对比 checklist。

最后提醒：**M4 Phase 2 教训——编译和测试通过不等于功能完成，必须逐项对比原版。**
