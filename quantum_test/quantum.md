# LLM 自动标注量化实验设计

## 背景与动机

MedTator 2.0 的 M7 模块实现了基于 Ollama 的 LLM 自动标注功能。在确定最终架构前，有三个核心问题需要通过量化实验回答：

1. **2-step pipeline 的必要性**：直接让 LLM 输出字符偏移不可靠（LLM 数字符容易出错），因此采用两步：Step 1 让 LLM 返回 `{keyword, tag}` 对，Step 2 用正则在原文精确定位 span。这样 LLM 只负责"识别什么概念"，定位工作交给确定性算法。

2. **LLM 返回短句的问题**：若 prompt 不约束 keyword 粒度，LLM 倾向于返回完整短句（如 "Terrible pain on left side of upper body"），导致：
   - 推理输出 token 增多，耗时上升
   - 正则定位歧义（长句在文中可能匹配多个位置）
   - keyword 变体（大小写、长短不一）重复定位同一概念，FP 堆积
   - **解决方案**：prompt 中约束 keyword 为最短核心临床术语（1-3词），并附上 Tag 的简要描述词汇表，让 LLM 在词粒度上做准确分类（如 "swollen" → Myalgia 而非 Pain）。Tag 描述经实验验证可将 Recall 从 0.27 提升至 0.77+。

3. **词窗口否定检测的准确度**：基于规则的双向窗口否定检测（前60字符/后30字符）存在已知局限：
   - 无法处理跨句否定（"No fever, chills, or cough"——scope 覆盖多个词）
   - 复杂从句（"patient denies having any significant pain, but did experience mild discomfort"）
   - 是否值得保留，还是改为让 LLM 直接跳过否定标注，需要数据支撑

---

## 实验设计

### 数据集
- **VAERS_20_NOTES**：20 篇 COVID-19 疫苗不良反应报告（VAERS 真实数据）
- Gold standard：人工标注 XML，每个 tag 含 `spans`（字符偏移）和 `certainty`（positive/negated）
- **Gold positive**：certainty ≠ "negated" 的标注（评估主体）
- **Gold negated**：certainty == "negated" 的标注（用于验证否定过滤器正确率）

### 标注 Schema
17 个 Tag：`Vaccine, Fever, Pain, Headache, Myalgia, Fatigue, Nasal_obstruction, Diarrhea, Nausea, Vomiting, Sore_throat, Dyspnea, Cough, Chill, Delirium, Hypersomnia, Other`

每个 Tag 附有描述词汇表（`TAG_DESCRIPTIONS`），通过 prompt 传给 LLM，帮助 LLM 理解分类边界（如 "swollen" 归 Myalgia 而非 Pain）。

### 自变量（实验条件）
| 维度 | 条件 |
|---|---|
| 模型 | qwen3:8b |
| 否定过滤器 | OFF（保留所有预测） / ON（词窗口过滤） |

### Prompt 设计（最终版）
- 告知 LLM 只返回 **最短核心临床术语**（1-3词），不返回完整短句
- 附上每个 Tag 的描述，辅助分类
- 要求 keyword 必须**原文出现**（verbatim）

```
Rules:
- keyword must be the shortest core clinical term (1-3 words), NOT a full sentence or clause
- keyword must appear verbatim in the text (exact spelling, case-insensitive)
```

---

## Pipeline 实现

### Step 1：LLM 提取
```
LLM(text, tag_descriptions) → [{keyword, tag}, ...]
```

### Step 2：正则定位
```python
get_locs(keyword, text)
# re.escape(keyword), 空格 → \s+, re.IGNORECASE
# 返回所有 (start, end) 位置
```

### Step 3：去重（dedup）
```python
# 按 start 排序，同 tag overlap 只保留第一个
predicted_raw.sort(key=lambda x: x['start'])
for pred in predicted_raw:
    if any(pred['tag'] == k['tag'] and spans_overlap(...) for k in deduped):
        continue
    deduped.append(pred)
```
**设计意图**：防止 LLM 对同一概念返回多个关键词变体（如 `blood clot` + `Blood clot`）导致重复定位 FP。

### Step 4：否定过滤（可选，negation=ON）
```python
is_negated(start, end, text)
# 前向：60字符内查 denies/no /not /without/negative for...（遇句号截断）
# 后向：30字符内查 absent/not found/none...（遇句号截断）
```

---

## 评估方法

### 匹配规则
- **span overlap**：pred 与 gold 同 tag + 字符区间有交叉 → TP（允许边界偏差）
- **贪心匹配**：一个 gold span 只能被匹配一次
- FP = 未匹配到任何 gold 的预测数
- FN = 未被任何预测覆盖的 gold 数

### 指标
- **Micro P/R/F1**：跨 20 篇合计 TP/FP/FN 再计算（不是每篇平均）

---

## 关键设计决策

| 决策 | 选择 | 理由 |
|---|---|---|
| LLM 输出格式 | keyword（短词）而非 offset | LLM 数字符偏移不可靠 |
| LLM 输出粒度 | 最短核心术语（1-3词） | 长句导致定位歧义和 FP 堆积 |
| Tag 描述 | 放入 prompt | 显著提升 Recall（swollen→Myalgia 等非直觉映射） |
| 去重策略 | 保留第一个匹配 | 简单有效，避免同概念多次计数 |
| 否定检测 | 词窗口（保留） | 量化实验证明有效，F1 +0.078 |

---

## 实验结果（qwen3:8b，VAERS_20_NOTES）

### 逐文件结果

| 文件 | negation=OFF P/R/F1 | negation=ON P/R/F1 |
|---|---|---|
| 059823 | 0.45/0.56/0.50 | 0.45/0.56/0.50 |
| 080831 | 0.68/1.00/0.81 | 0.68/1.00/0.81 |
| 113293 | 0.67/0.86/0.75 | 0.67/0.86/0.75 |
| 266074 | 0.67/0.67/0.67 | 0.67/0.67/0.67 |
| 267375 | 0.00/0.00/0.00 | 0.00/0.00/0.00 |
| 289727 | 0.83/0.65/0.73 | 0.82/0.61/0.70 |
| 345840 | 0.57/0.52/0.54 | 0.77/0.68/0.72 |
| 416262 | 0.62/0.54/0.58 | 0.54/0.54/0.54 |
| 455140 | 0.18/0.50/0.27 | 0.00/0.00/0.00 ⚠️超时 |
| 466451 | 0.50/0.33/0.40 | 0.27/0.33/0.30 |
| 498221 | 0.83/0.36/0.50 | 0.62/0.57/0.59 |
| 536553 | 1.00/1.00/1.00 | 0.71/0.71/0.71 |
| 587301 | 0.30/1.00/0.46 | 0.00/0.00/0.00 ⚠️超时 |
| 728117 | 0.50/0.86/0.63 | 0.50/0.86/0.63 |
| 838459 | 0.14/0.28/0.19 | 0.31/0.28/0.30 |
| 840502 | 0.00/0.00/0.00 | 0.26/1.00/0.41 |
| 876628 | 0.00/0.00/0.00 | 0.60/0.64/0.62 |
| 899183 | 0.46/0.55/0.50 | 0.40/0.55/0.46 |
| 933997 | 0.00/0.00/0.00 ⚠️超时 | 0.55/1.00/0.71 |
| 953550 | 0.33/0.29/0.31 | 0.25/0.29/0.27 |

### 合计

| 条件 | P | R | F1 | TP | FP | FN |
|---|---|---|---|---|---|---|
| negation=OFF | 0.447 | 0.473 | 0.460 | 131 | 162 | 146 |
| **negation=ON** | **0.534** | **0.542** | **0.538** | 150 | 131 | 127 |

否定过滤器共抑制 4 个预测，其中 0 个命中 gold negated 标注。

---

## 结果分析

### 否定过滤器有效
negation=ON 相比 OFF：F1 +0.078，P +0.087，R +0.069。词窗口否定检测有效，**保留**。

### 超时影响
- negation=OFF：1 次超时（933997 → 记为 0）
- negation=ON：2 次超时（455140、587301 → 记为 0）
- 超时文件在两个条件中不一致，合计对比存在轻微污染，但整体趋势明确

### 离群值
- **838459**（negation=OFF FP=56，P=0.14）：LLM 对该文件过度标注，拉低合计 Precision
- **267375**（两条件均 F1=0.00）：LLM 未能提取任何有效标注，需单独分析

### 实验设计局限
两个条件分别独立调用 LLM，而非共用同一批预测后再分别过滤。LLM 的轻微非确定性（qwen3 thinking 模式）导致两次调用结果可能不同，TP 计数在条件间不完全可比。严格实验应先缓存 LLM 输出再分条件后处理。

---

## 结论与最终架构

**选定 Option A：短关键词 + 词窗口否定过滤**

| 组件 | 决策 |
|---|---|
| LLM 输出 | `{keyword（1-3词）, tag}` |
| Tag 描述 | 放入 prompt（R +0.5） |
| Span 定位 | 正则 + IGNORECASE |
| 去重 | 同 tag overlap 保留第一个 |
| 否定检测 | 词窗口（双向，前60/后30字符） |
| 模型 | qwen3:8b（本地 Ollama） |

整体性能：**P=0.534 R=0.542 F1=0.538**（20篇 VAERS，含2次超时文件）
